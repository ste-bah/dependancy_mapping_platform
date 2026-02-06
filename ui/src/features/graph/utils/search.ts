/**
 * Graph Search Logic
 * Fuse.js based search utilities for graph nodes
 * @module features/graph/utils/search
 */

import Fuse from 'fuse.js';
import type { GraphNode, FlowNode } from '../types';
import { FUSE_OPTIONS, SEARCH_DEFAULTS } from './constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Search result with match information
 */
export interface SearchResult {
  /** The matched node */
  node: GraphNode;
  /** Match score (0 = perfect, 1 = no match) */
  score: number;
  /** Match details for highlighting */
  matches: SearchMatch[];
}

/**
 * Match information for a single field
 */
export interface SearchMatch {
  /** Field key that matched */
  key: string;
  /** Character index ranges that matched */
  indices: ReadonlyArray<readonly [number, number]>;
  /** The matched value */
  value: string;
}

/**
 * Search result for FlowNode (includes position)
 */
export interface FlowNodeSearchResult {
  /** The matched FlowNode */
  node: FlowNode;
  /** Match score */
  score: number;
  /** Match details */
  matches: SearchMatch[];
}

// ============================================================================
// Index Creation
// ============================================================================

/**
 * Create a Fuse.js search index for graph nodes
 *
 * @param nodes - Array of GraphNodes to index
 * @param options - Optional Fuse.js options override
 * @returns Fuse instance ready for searching
 *
 * @example
 * ```ts
 * const fuse = createSearchIndex(nodes);
 * const results = searchNodes(fuse, 'database');
 * ```
 */
export function createSearchIndex(
  nodes: GraphNode[],
  options: Fuse.IFuseOptions<GraphNode> = FUSE_OPTIONS
): Fuse<GraphNode> {
  return new Fuse(nodes, options);
}

/**
 * Create a Fuse.js search index for FlowNodes
 *
 * @param nodes - Array of FlowNodes to index
 * @param options - Optional Fuse.js options override
 * @returns Fuse instance for FlowNode searching
 */
export function createFlowNodeSearchIndex(
  nodes: FlowNode[],
  options?: Partial<Fuse.IFuseOptions<FlowNode>>
): Fuse<FlowNode> {
  const defaultOptions: Fuse.IFuseOptions<FlowNode> = {
    includeScore: true,
    includeMatches: true,
    threshold: 0.4,
    ignoreLocation: true,
    keys: [
      { name: 'data.name', weight: 2.0 },
      { name: 'data.id', weight: 1.5 },
      { name: 'data.type', weight: 1.0 },
      { name: 'data.location.filePath', weight: 0.8 },
    ],
    minMatchCharLength: 2,
  };

  return new Fuse(nodes, { ...defaultOptions, ...options });
}

// ============================================================================
// Search Functions
// ============================================================================

/**
 * Search nodes using a Fuse.js index
 *
 * @param fuse - Fuse instance with indexed nodes
 * @param query - Search query string
 * @param maxResults - Maximum number of results to return
 * @returns Array of search results sorted by relevance
 *
 * @example
 * ```ts
 * const fuse = createSearchIndex(nodes);
 * const results = searchNodes(fuse, 'aws_s3_bucket');
 * results.forEach(r => console.log(r.node.name, r.score));
 * ```
 */
export function searchNodes(
  fuse: Fuse<GraphNode>,
  query: string,
  maxResults: number = SEARCH_DEFAULTS.maxResults
): SearchResult[] {
  if (!query || query.trim().length < SEARCH_DEFAULTS.minQueryLength) {
    return [];
  }

  const fuseResults = fuse.search(query.trim(), { limit: maxResults });

  return fuseResults.map(result => ({
    node: result.item,
    score: result.score ?? 1,
    matches: transformFuseMatches(result.matches),
  }));
}

/**
 * Search FlowNodes using a Fuse.js index
 *
 * @param fuse - Fuse instance with indexed FlowNodes
 * @param query - Search query string
 * @param maxResults - Maximum results
 * @returns Array of FlowNode search results
 */
export function searchFlowNodes(
  fuse: Fuse<FlowNode>,
  query: string,
  maxResults: number = SEARCH_DEFAULTS.maxResults
): FlowNodeSearchResult[] {
  if (!query || query.trim().length < SEARCH_DEFAULTS.minQueryLength) {
    return [];
  }

  const fuseResults = fuse.search(query.trim(), { limit: maxResults });

  return fuseResults.map(result => ({
    node: result.item,
    score: result.score ?? 1,
    matches: transformFuseMatches(result.matches),
  }));
}

/**
 * Transform Fuse.js match format to our SearchMatch format
 */
function transformFuseMatches(
  matches: readonly Fuse.FuseResultMatch[] | undefined
): SearchMatch[] {
  if (!matches) {
    return [];
  }

  return matches.map(match => ({
    key: match.key ?? '',
    indices: match.indices,
    value: match.value ?? '',
  }));
}

// ============================================================================
// Highlight Utilities
// ============================================================================

/**
 * Highlight matched portions of text with HTML tags
 *
 * @param text - Original text to highlight
 * @param indices - Array of [start, end] index pairs
 * @param tag - HTML tag to use for highlighting (default: 'mark')
 * @returns String with highlighted portions wrapped in tags
 *
 * @example
 * ```ts
 * const highlighted = highlightMatch('hello world', [[0, 4]]);
 * // Returns: '<mark>hello</mark> world'
 * ```
 */
export function highlightMatch(
  text: string,
  indices: ReadonlyArray<readonly [number, number]>,
  tag: string = SEARCH_DEFAULTS.highlightTag
): string {
  if (!text || !indices || indices.length === 0) {
    return text ?? '';
  }

  // Sort indices by start position
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

  // Merge overlapping indices
  const mergedIndices: Array<[number, number]> = [];
  for (const [start, end] of sortedIndices) {
    if (mergedIndices.length === 0) {
      mergedIndices.push([start, end]);
    } else {
      const last = mergedIndices[mergedIndices.length - 1];
      if (start <= last[1] + 1) {
        // Overlapping or adjacent, merge
        last[1] = Math.max(last[1], end);
      } else {
        mergedIndices.push([start, end]);
      }
    }
  }

  // Build highlighted string
  let result = '';
  let lastIndex = 0;

  for (const [start, end] of mergedIndices) {
    // Clamp indices to valid range
    const safeStart = Math.max(0, Math.min(start, text.length));
    const safeEnd = Math.max(0, Math.min(end + 1, text.length));

    // Add non-matched portion
    result += escapeHtml(text.slice(lastIndex, safeStart));

    // Add highlighted portion
    const matchedText = text.slice(safeStart, safeEnd);
    result += `<${tag}>${escapeHtml(matchedText)}</${tag}>`;

    lastIndex = safeEnd;
  }

  // Add remaining text
  result += escapeHtml(text.slice(lastIndex));

  return result;
}

/**
 * Highlight matches in a search result for display
 *
 * @param result - Search result with match information
 * @param fieldKey - Field to highlight ('name', 'id', etc.)
 * @returns Highlighted string or original value if no matches
 */
export function highlightSearchResult(
  result: SearchResult,
  fieldKey: string
): string {
  const match = result.matches.find(m => m.key === fieldKey);

  if (!match) {
    // Return raw value
    if (fieldKey === 'name') return result.node.name;
    if (fieldKey === 'id') return result.node.id;
    if (fieldKey === 'type') return result.node.type;
    if (fieldKey === 'location.filePath') return result.node.location?.filePath ?? '';
    return '';
  }

  return highlightMatch(match.value, match.indices);
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

// ============================================================================
// Quick Search (No Index)
// ============================================================================

/**
 * Simple search without Fuse.js index
 * Useful for small datasets or one-off searches
 *
 * @param nodes - Array of GraphNodes to search
 * @param query - Search query string
 * @param maxResults - Maximum results
 * @returns Array of matching nodes (no scoring)
 */
export function quickSearch(
  nodes: GraphNode[],
  query: string,
  maxResults: number = SEARCH_DEFAULTS.maxResults
): GraphNode[] {
  if (!query || query.trim().length < SEARCH_DEFAULTS.minQueryLength) {
    return [];
  }

  const searchLower = query.toLowerCase().trim();
  const results: GraphNode[] = [];

  for (const node of nodes) {
    if (results.length >= maxResults) break;

    const searchableText = [
      node.name,
      node.id,
      node.type,
      node.location?.filePath ?? '',
    ].join(' ').toLowerCase();

    if (searchableText.includes(searchLower)) {
      results.push(node);
    }
  }

  return results;
}

/**
 * Quick search for FlowNodes without index
 *
 * @param nodes - Array of FlowNodes to search
 * @param query - Search query string
 * @param maxResults - Maximum results
 * @returns Matching FlowNodes
 */
export function quickSearchFlowNodes(
  nodes: FlowNode[],
  query: string,
  maxResults: number = SEARCH_DEFAULTS.maxResults
): FlowNode[] {
  if (!query || query.trim().length < SEARCH_DEFAULTS.minQueryLength) {
    return [];
  }

  const searchLower = query.toLowerCase().trim();
  const results: FlowNode[] = [];

  for (const node of nodes) {
    if (results.length >= maxResults) break;

    const searchableText = [
      node.data.name,
      node.data.id,
      node.data.type,
      node.data.location?.filePath ?? '',
    ].join(' ').toLowerCase();

    if (searchableText.includes(searchLower)) {
      results.push(node);
    }
  }

  return results;
}

// ============================================================================
// Search Helpers
// ============================================================================

/**
 * Check if a query is valid for searching
 *
 * @param query - Query string to validate
 * @param minLength - Minimum required length
 * @returns True if query is valid
 */
export function isValidSearchQuery(
  query: string,
  minLength: number = SEARCH_DEFAULTS.minQueryLength
): boolean {
  return Boolean(query && query.trim().length >= minLength);
}

/**
 * Normalize a search query (trim, lowercase)
 *
 * @param query - Query string to normalize
 * @returns Normalized query
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Get the best match field from search results
 *
 * @param result - Search result
 * @returns The key of the best matching field or null
 */
export function getBestMatchField(result: SearchResult): string | null {
  if (result.matches.length === 0) {
    return null;
  }

  // Return the field with most matched characters
  let bestMatch = result.matches[0];
  let bestScore = 0;

  for (const match of result.matches) {
    const matchedChars = match.indices.reduce(
      (sum, [start, end]) => sum + (end - start + 1),
      0
    );

    if (matchedChars > bestScore) {
      bestScore = matchedChars;
      bestMatch = match;
    }
  }

  return bestMatch.key;
}
