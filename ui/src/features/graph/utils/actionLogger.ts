/**
 * Graph Action Logger
 * Track user interactions and actions for analytics and debugging
 * @module features/graph/utils/actionLogger
 */

import { isDevelopment, isProduction } from '../config/env';
import { graphLogger } from './logger';
import type { GraphFilters, GraphNodeType } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Base user action with common properties
 */
interface BaseAction {
  /** Timestamp of the action */
  timestamp: string;
  /** Session ID for grouping actions */
  sessionId: string;
}

/**
 * Node click action
 */
export interface NodeClickAction extends BaseAction {
  type: 'node_click';
  nodeId: string;
  nodeType: GraphNodeType;
}

/**
 * Node hover action
 */
export interface NodeHoverAction extends BaseAction {
  type: 'node_hover';
  nodeId: string;
  nodeType: GraphNodeType;
  hoverDuration?: number;
}

/**
 * Filter change action
 */
export interface FilterChangeAction extends BaseAction {
  type: 'filter_change';
  filters: Partial<GraphFilters>;
  previousFilters?: Partial<GraphFilters>;
}

/**
 * Search action
 */
export interface SearchAction extends BaseAction {
  type: 'search';
  query: string;
  resultCount: number;
  searchDuration?: number;
}

/**
 * Blast radius action
 */
export interface BlastRadiusAction extends BaseAction {
  type: 'blast_radius';
  nodeId: string;
  affectedCount: number;
  impactScore?: number;
}

/**
 * Export action
 */
export interface ExportAction extends BaseAction {
  type: 'export';
  format: 'png' | 'svg' | 'json' | 'csv';
  nodeCount?: number;
  edgeCount?: number;
}

/**
 * Zoom action
 */
export interface ZoomAction extends BaseAction {
  type: 'zoom';
  direction: 'in' | 'out' | 'fit' | 'reset';
  zoomLevel: number;
}

/**
 * Pan action
 */
export interface PanAction extends BaseAction {
  type: 'pan';
  deltaX: number;
  deltaY: number;
}

/**
 * Layout change action
 */
export interface LayoutChangeAction extends BaseAction {
  type: 'layout_change';
  algorithm: string;
  direction?: string;
  nodeCount: number;
  duration?: number;
}

/**
 * Error encountered action
 */
export interface ErrorAction extends BaseAction {
  type: 'error';
  errorCode: string;
  errorMessage: string;
  component?: string;
}

/**
 * Graph load action
 */
export interface GraphLoadAction extends BaseAction {
  type: 'graph_load';
  scanId: string;
  nodeCount: number;
  edgeCount: number;
  loadDuration: number;
}

/**
 * Selection change action
 */
export interface SelectionChangeAction extends BaseAction {
  type: 'selection_change';
  previousNodeId: string | null;
  newNodeId: string | null;
}

/**
 * Union type of all user actions
 */
export type UserAction =
  | NodeClickAction
  | NodeHoverAction
  | FilterChangeAction
  | SearchAction
  | BlastRadiusAction
  | ExportAction
  | ZoomAction
  | PanAction
  | LayoutChangeAction
  | ErrorAction
  | GraphLoadAction
  | SelectionChangeAction;

/**
 * Action log entry for storage
 */
export interface ActionLogEntry {
  action: UserAction;
  metadata?: Record<string, unknown>;
}

/**
 * Action logger configuration
 */
export interface ActionLoggerConfig {
  /** Enable action logging */
  enabled: boolean;
  /** Log to console in development */
  logToConsole: boolean;
  /** Maximum actions to store in memory */
  maxActions: number;
  /** Custom handler for actions (e.g., send to analytics) */
  onAction?: (action: UserAction) => void;
  /** Debounce interval for frequent actions like hover (ms) */
  debounceMs: number;
  /** Actions to exclude from logging */
  excludeActions?: UserAction['type'][];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ActionLoggerConfig = {
  enabled: true,
  logToConsole: isDevelopment(),
  maxActions: 500,
  debounceMs: 100,
  excludeActions: isProduction() ? ['node_hover', 'pan'] : [],
};

// ============================================================================
// State
// ============================================================================

let config: ActionLoggerConfig = { ...DEFAULT_CONFIG };

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

let currentSessionId = generateSessionId();

/**
 * Action history
 */
let actionHistory: ActionLogEntry[] = [];

/**
 * Debounce timers for frequent actions
 */
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Last action timestamps for rate limiting
 */
const lastActionTimestamps: Map<string, number> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create base action with common properties
 */
function createBaseAction(): BaseAction {
  return {
    timestamp: new Date().toISOString(),
    sessionId: currentSessionId,
  };
}

/**
 * Check if action type is excluded
 */
function isExcluded(actionType: UserAction['type']): boolean {
  return config.excludeActions?.includes(actionType) ?? false;
}

/**
 * Check if action should be rate limited
 */
function shouldRateLimit(actionType: string, debounceMs?: number): boolean {
  const now = Date.now();
  const lastTimestamp = lastActionTimestamps.get(actionType);
  const threshold = debounceMs ?? config.debounceMs;

  if (lastTimestamp && now - lastTimestamp < threshold) {
    return true;
  }

  lastActionTimestamps.set(actionType, now);
  return false;
}

/**
 * Store action in history
 */
function storeAction(action: UserAction, metadata?: Record<string, unknown>): void {
  actionHistory.push({ action, metadata });

  // Trim history if needed
  if (actionHistory.length > config.maxActions) {
    actionHistory = actionHistory.slice(-config.maxActions);
  }
}

/**
 * Process and log an action
 */
function processAction(action: UserAction, metadata?: Record<string, unknown>): void {
  if (!config.enabled || isExcluded(action.type)) {
    return;
  }

  // Store in history
  storeAction(action, metadata);

  // Log to console in development
  if (config.logToConsole) {
    graphLogger.debug(`User action: ${action.type}`, {
      action: action.type,
      ...action,
    });
  }

  // Call custom handler
  if (config.onAction) {
    try {
      config.onAction(action);
    } catch {
      // Silently fail - don't let analytics cause errors
    }
  }

  // Send to analytics in production (if configured)
  sendToAnalytics(action);
}

/**
 * Send action to analytics service
 * This is a placeholder for integration with analytics services
 */
function sendToAnalytics(action: UserAction): void {
  // Check if analytics is enabled
  const analyticsEnabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';

  if (!analyticsEnabled || !isProduction()) {
    return;
  }

  // Sanitize action data before sending
  const sanitizedAction = {
    type: action.type,
    timestamp: action.timestamp,
    sessionId: action.sessionId,
    // Include only non-sensitive fields based on action type
    ...getSafeActionData(action),
  };

  try {
    // Use sendBeacon for non-blocking analytics
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/analytics/actions',
        JSON.stringify(sanitizedAction)
      );
    }
  } catch {
    // Silently fail
  }
}

/**
 * Get safe (non-PII) data from action
 */
function getSafeActionData(action: UserAction): Record<string, unknown> {
  switch (action.type) {
    case 'node_click':
    case 'node_hover':
      return { nodeType: action.nodeType };
    case 'search':
      return { resultCount: action.resultCount, queryLength: action.query.length };
    case 'blast_radius':
      return { affectedCount: action.affectedCount, impactScore: action.impactScore };
    case 'export':
      return { format: action.format, nodeCount: action.nodeCount };
    case 'filter_change':
      return { filterKeys: Object.keys(action.filters) };
    case 'zoom':
      return { direction: action.direction, zoomLevel: action.zoomLevel };
    case 'layout_change':
      return { algorithm: action.algorithm, nodeCount: action.nodeCount };
    case 'graph_load':
      return { nodeCount: action.nodeCount, edgeCount: action.edgeCount, loadDuration: action.loadDuration };
    case 'error':
      return { errorCode: action.errorCode };
    default:
      return {};
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Log a user action
 *
 * @param action - The user action to log
 *
 * @example
 * ```ts
 * logUserAction({
 *   type: 'node_click',
 *   nodeId: 'node-123',
 *   nodeType: 'terraform_resource',
 * });
 * ```
 */
export function logUserAction(
  action: Omit<UserAction, 'timestamp' | 'sessionId'>
): void {
  const fullAction = {
    ...createBaseAction(),
    ...action,
  } as UserAction;

  processAction(fullAction);
}

/**
 * Log a node click action
 */
export function logNodeClick(nodeId: string, nodeType: GraphNodeType): void {
  logUserAction({
    type: 'node_click',
    nodeId,
    nodeType,
  });
}

/**
 * Log a node hover action (debounced)
 */
export function logNodeHover(
  nodeId: string,
  nodeType: GraphNodeType,
  hoverDuration?: number
): void {
  // Rate limit hover events
  if (shouldRateLimit(`hover_${nodeId}`, 500)) {
    return;
  }

  logUserAction({
    type: 'node_hover',
    nodeId,
    nodeType,
    hoverDuration,
  });
}

/**
 * Log a filter change action
 */
export function logFilterChange(
  filters: Partial<GraphFilters>,
  previousFilters?: Partial<GraphFilters>
): void {
  logUserAction({
    type: 'filter_change',
    filters,
    previousFilters,
  });
}

/**
 * Log a search action
 */
export function logSearch(
  query: string,
  resultCount: number,
  searchDuration?: number
): void {
  // Don't log empty searches
  if (!query.trim()) return;

  logUserAction({
    type: 'search',
    query,
    resultCount,
    searchDuration,
  });
}

/**
 * Log a blast radius action
 */
export function logBlastRadius(
  nodeId: string,
  affectedCount: number,
  impactScore?: number
): void {
  logUserAction({
    type: 'blast_radius',
    nodeId,
    affectedCount,
    impactScore,
  });
}

/**
 * Log an export action
 */
export function logExport(
  format: ExportAction['format'],
  nodeCount?: number,
  edgeCount?: number
): void {
  logUserAction({
    type: 'export',
    format,
    nodeCount,
    edgeCount,
  });
}

/**
 * Log a zoom action
 */
export function logZoom(
  direction: ZoomAction['direction'],
  zoomLevel: number
): void {
  // Rate limit zoom events
  if (shouldRateLimit('zoom', 200)) {
    return;
  }

  logUserAction({
    type: 'zoom',
    direction,
    zoomLevel,
  });
}

/**
 * Log a pan action
 */
export function logPan(deltaX: number, deltaY: number): void {
  // Rate limit pan events heavily
  if (shouldRateLimit('pan', 500)) {
    return;
  }

  logUserAction({
    type: 'pan',
    deltaX,
    deltaY,
  });
}

/**
 * Log a layout change action
 */
export function logLayoutChange(
  algorithm: string,
  nodeCount: number,
  direction?: string,
  duration?: number
): void {
  logUserAction({
    type: 'layout_change',
    algorithm,
    direction,
    nodeCount,
    duration,
  });
}

/**
 * Log a graph load action
 */
export function logGraphLoad(
  scanId: string,
  nodeCount: number,
  edgeCount: number,
  loadDuration: number
): void {
  logUserAction({
    type: 'graph_load',
    scanId,
    nodeCount,
    edgeCount,
    loadDuration,
  });
}

/**
 * Log a selection change action
 */
export function logSelectionChange(
  previousNodeId: string | null,
  newNodeId: string | null
): void {
  logUserAction({
    type: 'selection_change',
    previousNodeId,
    newNodeId,
  });
}

/**
 * Log an error action
 */
export function logErrorAction(
  errorCode: string,
  errorMessage: string,
  component?: string
): void {
  logUserAction({
    type: 'error',
    errorCode,
    errorMessage,
    component,
  });
}

// ============================================================================
// History and Analytics
// ============================================================================

/**
 * Get action history
 *
 * @param limit - Maximum number of actions to return
 * @returns Recent actions
 */
export function getActionHistory(limit?: number): ActionLogEntry[] {
  const count = limit ?? config.maxActions;
  return actionHistory.slice(-count);
}

/**
 * Get action count by type
 */
export function getActionCounts(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of actionHistory) {
    counts[entry.action.type] = (counts[entry.action.type] ?? 0) + 1;
  }

  return counts;
}

/**
 * Get session summary
 */
export function getSessionSummary(): {
  sessionId: string;
  actionCount: number;
  actionCounts: Record<string, number>;
  sessionDuration: number;
  firstAction?: string;
  lastAction?: string;
} {
  const counts = getActionCounts();
  const firstEntry = actionHistory[0];
  const lastEntry = actionHistory[actionHistory.length - 1];

  let sessionDuration = 0;
  if (firstEntry && lastEntry) {
    sessionDuration = new Date(lastEntry.action.timestamp).getTime() -
      new Date(firstEntry.action.timestamp).getTime();
  }

  return {
    sessionId: currentSessionId,
    actionCount: actionHistory.length,
    actionCounts: counts,
    sessionDuration,
    firstAction: firstEntry?.action.timestamp,
    lastAction: lastEntry?.action.timestamp,
  };
}

/**
 * Clear action history
 */
export function clearActionHistory(): void {
  actionHistory = [];
}

/**
 * Start a new session
 */
export function startNewSession(): string {
  currentSessionId = generateSessionId();
  actionHistory = [];
  lastActionTimestamps.clear();
  return currentSessionId;
}

/**
 * Get current session ID
 */
export function getSessionId(): string {
  return currentSessionId;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configure the action logger
 */
export function configureActionLogger(
  newConfig: Partial<ActionLoggerConfig>
): void {
  config = { ...config, ...newConfig };
}

/**
 * Reset action logger configuration
 */
export function resetActionLoggerConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

// ============================================================================
// Development Tools
// ============================================================================

/**
 * Expose action logger tools in development mode
 */
if (isDevelopment() && typeof window !== 'undefined') {
  (window as { __graphActions?: unknown }).__graphActions = {
    getHistory: getActionHistory,
    getCounts: getActionCounts,
    getSummary: getSessionSummary,
    clear: clearActionHistory,
    newSession: startNewSession,
    configure: configureActionLogger,
  };
}
