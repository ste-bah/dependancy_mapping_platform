/**
 * Graph Debug Tools
 * Development-only debug utilities for the graph visualization feature
 * @module features/graph/utils/debug
 */

import { isDevelopment } from '../config/env';
import { graphLogger } from './logger';
import { getPerformanceMetrics, generatePerformanceReport } from './performanceLogger';
import { getActionHistory, getSessionSummary, getActionCounts } from './actionLogger';
import { getErrorMetrics, getErrorDebugSummary } from './errorLogging';
import type { FlowNode, FlowEdge, GraphData } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Debug state snapshot
 */
export interface GraphDebugState {
  /** Current nodes in the graph */
  nodes: FlowNode[];
  /** Current edges in the graph */
  edges: FlowEdge[];
  /** Selected node ID */
  selectedNodeId: string | null;
  /** Current filters */
  filters: Record<string, unknown>;
  /** Viewport state */
  viewport: { x: number; y: number; zoom: number };
  /** Timestamp of snapshot */
  timestamp: string;
}

/**
 * Debug inspector result
 */
export interface NodeInspection {
  node: FlowNode;
  incomingEdges: FlowEdge[];
  outgoingEdges: FlowEdge[];
  connectedNodes: {
    incoming: string[];
    outgoing: string[];
  };
  metadata: Record<string, unknown>;
}

/**
 * Global debug interface
 */
export interface GraphDebugInterface {
  // State inspection
  getState: () => GraphDebugState | null;
  dumpState: () => void;
  inspectNode: (nodeId: string) => NodeInspection | null;
  listNodes: () => void;
  listEdges: () => void;

  // Performance
  getPerformance: () => ReturnType<typeof getPerformanceMetrics>;
  perfReport: () => void;

  // Actions
  getActions: () => ReturnType<typeof getActionHistory>;
  actionSummary: () => void;

  // Errors
  getErrors: () => ReturnType<typeof getErrorMetrics>;
  errorSummary: () => void;

  // Utilities
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => void;

  // Full report
  fullReport: () => void;
}

// ============================================================================
// State
// ============================================================================

let debugEnabled = isDevelopment();
let currentState: GraphDebugState | null = null;

/**
 * Store reference to graph state setter
 * This will be called by the graph components to update debug state
 */
type StateUpdater = (state: Partial<GraphDebugState>) => void;
let stateUpdater: StateUpdater | null = null;

// ============================================================================
// State Management
// ============================================================================

/**
 * Register a state updater function
 * Called by graph components to enable state tracking
 *
 * @internal
 */
export function registerStateUpdater(updater: StateUpdater): () => void {
  stateUpdater = updater;
  return () => {
    stateUpdater = null;
  };
}

/**
 * Update the debug state
 * Called by graph components when state changes
 *
 * @internal
 */
export function updateDebugState(state: Partial<GraphDebugState>): void {
  if (!debugEnabled) return;

  currentState = {
    nodes: state.nodes ?? currentState?.nodes ?? [],
    edges: state.edges ?? currentState?.edges ?? [],
    selectedNodeId: state.selectedNodeId ?? currentState?.selectedNodeId ?? null,
    filters: state.filters ?? currentState?.filters ?? {},
    viewport: state.viewport ?? currentState?.viewport ?? { x: 0, y: 0, zoom: 1 },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Set full graph data for debugging
 *
 * @internal
 */
export function setDebugGraphData(
  nodes: FlowNode[],
  edges: FlowEdge[],
  selectedNodeId: string | null = null
): void {
  if (!debugEnabled) return;

  updateDebugState({ nodes, edges, selectedNodeId });
}

// ============================================================================
// Debug Functions
// ============================================================================

/**
 * Enable graph debugging
 * Activates state tracking and console tools
 */
export function enableGraphDebug(): void {
  debugEnabled = true;
  graphLogger.configure({ minLevel: 'debug' });
  graphLogger.info('Graph debug mode enabled');

  if (typeof window !== 'undefined') {
    console.log('%c[Graph Debug] Enabled', 'color: #4CAF50; font-weight: bold');
    console.log('Access debug tools via window.__graphDebug');
  }
}

/**
 * Disable graph debugging
 * Stops state tracking and reduces logging
 */
export function disableGraphDebug(): void {
  debugEnabled = false;
  currentState = null;
  graphLogger.configure({ minLevel: 'warn' });

  if (typeof window !== 'undefined') {
    console.log('%c[Graph Debug] Disabled', 'color: #FF5722; font-weight: bold');
  }
}

/**
 * Check if debugging is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Dump current graph state to console
 */
export function dumpGraphState(): void {
  if (!debugEnabled) {
    console.warn('[Graph Debug] Debug mode is disabled. Call enableGraphDebug() first.');
    return;
  }

  if (!currentState) {
    console.warn('[Graph Debug] No state available. Make sure the graph is mounted.');
    return;
  }

  console.group('%c[Graph State Dump]', 'color: #2196F3; font-weight: bold');
  console.log('Timestamp:', currentState.timestamp);
  console.log('Nodes:', currentState.nodes.length);
  console.log('Edges:', currentState.edges.length);
  console.log('Selected:', currentState.selectedNodeId ?? 'none');
  console.log('Viewport:', currentState.viewport);
  console.log('Filters:', currentState.filters);

  console.group('Node Types');
  const nodeTypes = currentState.nodes.reduce((acc, node) => {
    acc[node.data.type] = (acc[node.data.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.table(nodeTypes);
  console.groupEnd();

  console.group('Edge Types');
  const edgeTypes = currentState.edges.reduce((acc, edge) => {
    const type = edge.data?.type ?? 'unknown';
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.table(edgeTypes);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Inspect a specific node
 *
 * @param nodeId - The ID of the node to inspect
 */
export function inspectNode(nodeId: string): NodeInspection | null {
  if (!debugEnabled || !currentState) {
    console.warn('[Graph Debug] Debug mode is disabled or no state available.');
    return null;
  }

  const node = currentState.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.warn(`[Graph Debug] Node not found: ${nodeId}`);
    return null;
  }

  const incomingEdges = currentState.edges.filter(e => e.target === nodeId);
  const outgoingEdges = currentState.edges.filter(e => e.source === nodeId);

  const inspection: NodeInspection = {
    node,
    incomingEdges,
    outgoingEdges,
    connectedNodes: {
      incoming: incomingEdges.map(e => e.source),
      outgoing: outgoingEdges.map(e => e.target),
    },
    metadata: node.data.metadata ?? {},
  };

  console.group(`%c[Node Inspection: ${nodeId}]`, 'color: #9C27B0; font-weight: bold');
  console.log('Name:', node.data.name);
  console.log('Type:', node.data.type);
  console.log('Position:', node.position);
  console.log('Location:', node.data.location);
  console.log('Incoming edges:', incomingEdges.length);
  console.log('Outgoing edges:', outgoingEdges.length);
  console.log('Connected from:', inspection.connectedNodes.incoming);
  console.log('Connected to:', inspection.connectedNodes.outgoing);
  console.log('Metadata:', inspection.metadata);
  console.groupEnd();

  return inspection;
}

/**
 * List all nodes in a table format
 */
export function listNodes(): void {
  if (!debugEnabled || !currentState) {
    console.warn('[Graph Debug] Debug mode is disabled or no state available.');
    return;
  }

  const nodeData = currentState.nodes.map(n => ({
    id: n.id.slice(0, 12) + '...',
    name: n.data.name,
    type: n.data.type,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    selected: n.data.selected ? 'Yes' : '',
    highlighted: n.data.highlighted ? 'Yes' : '',
  }));

  console.log(`%c[Graph Nodes] Total: ${currentState.nodes.length}`, 'color: #2196F3');
  console.table(nodeData);
}

/**
 * List all edges in a table format
 */
export function listEdges(): void {
  if (!debugEnabled || !currentState) {
    console.warn('[Graph Debug] Debug mode is disabled or no state available.');
    return;
  }

  const edgeData = currentState.edges.map(e => ({
    id: e.id.slice(0, 12) + '...',
    source: e.source.slice(0, 12) + '...',
    target: e.target.slice(0, 12) + '...',
    type: e.data?.type ?? 'unknown',
    confidence: e.data?.confidence?.toFixed(2) ?? 'N/A',
    highlighted: e.data?.highlighted ? 'Yes' : '',
  }));

  console.log(`%c[Graph Edges] Total: ${currentState.edges.length}`, 'color: #2196F3');
  console.table(edgeData);
}

/**
 * Print full debug report
 */
export function printFullReport(): void {
  console.log('%c=== GRAPH DEBUG REPORT ===', 'color: #FF9800; font-weight: bold; font-size: 14px');

  // State
  console.log('\n%c--- State ---', 'color: #2196F3; font-weight: bold');
  dumpGraphState();

  // Performance
  console.log('\n%c--- Performance ---', 'color: #4CAF50; font-weight: bold');
  console.log(generatePerformanceReport());

  // Actions
  console.log('\n%c--- User Actions ---', 'color: #9C27B0; font-weight: bold');
  const summary = getSessionSummary();
  console.log('Session ID:', summary.sessionId);
  console.log('Total actions:', summary.actionCount);
  console.log('Session duration:', `${Math.round(summary.sessionDuration / 1000)}s`);
  console.table(getActionCounts());

  // Errors
  console.log('\n%c--- Errors ---', 'color: #F44336; font-weight: bold');
  console.log(getErrorDebugSummary());

  console.log('\n%c=== END REPORT ===', 'color: #FF9800; font-weight: bold; font-size: 14px');
}

// ============================================================================
// Global Debug Interface
// ============================================================================

/**
 * Create the debug interface object
 */
function createDebugInterface(): GraphDebugInterface {
  return {
    // State inspection
    getState: () => currentState,
    dumpState: dumpGraphState,
    inspectNode,
    listNodes,
    listEdges,

    // Performance
    getPerformance: getPerformanceMetrics,
    perfReport: () => console.log(generatePerformanceReport()),

    // Actions
    getActions: getActionHistory,
    actionSummary: () => {
      const summary = getSessionSummary();
      console.log('%c[Action Summary]', 'color: #9C27B0; font-weight: bold');
      console.log('Session:', summary.sessionId);
      console.log('Actions:', summary.actionCount);
      console.log('Duration:', `${Math.round(summary.sessionDuration / 1000)}s`);
      console.table(summary.actionCounts);
    },

    // Errors
    getErrors: getErrorMetrics,
    errorSummary: () => console.log(getErrorDebugSummary()),

    // Utilities
    enable: enableGraphDebug,
    disable: disableGraphDebug,
    isEnabled: isDebugEnabled,
    setLogLevel: (level) => graphLogger.configure({ minLevel: level }),

    // Full report
    fullReport: printFullReport,
  };
}

// ============================================================================
// Window Global Exposure (Development Only)
// ============================================================================

/**
 * Expose debug interface on window in development mode
 */
if (isDevelopment() && typeof window !== 'undefined') {
  const debugInterface = createDebugInterface();

  // Type-safe window augmentation
  (window as { __graphDebug?: GraphDebugInterface }).__graphDebug = debugInterface;

  // Log availability
  console.log(
    '%c[Graph Debug] Available at window.__graphDebug',
    'color: #4CAF50; font-style: italic'
  );
  console.log(
    '%cMethods: getState(), dumpState(), inspectNode(id), listNodes(), listEdges(), ' +
    'getPerformance(), perfReport(), getActions(), actionSummary(), ' +
    'getErrors(), errorSummary(), enable(), disable(), fullReport()',
    'color: #888'
  );
}

// ============================================================================
// React Hook for Debug State
// ============================================================================

/**
 * Hook for components to register debug state updates
 *
 * @example
 * ```tsx
 * function GraphContainer() {
 *   const { nodes, edges } = useGraphData();
 *
 *   useGraphDebugState({ nodes, edges });
 *
 *   return <Graph nodes={nodes} edges={edges} />;
 * }
 * ```
 */
export function useGraphDebugState(state: {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  selectedNodeId?: string | null;
  filters?: Record<string, unknown>;
  viewport?: { x: number; y: number; zoom: number };
}): void {
  // Only update in development
  if (!isDevelopment()) return;

  // Update debug state when graph state changes
  updateDebugState({
    nodes: state.nodes,
    edges: state.edges,
    selectedNodeId: state.selectedNodeId,
    filters: state.filters,
    viewport: state.viewport,
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  createDebugInterface,
  type GraphDebugInterface,
};
