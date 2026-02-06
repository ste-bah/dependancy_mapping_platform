/**
 * SearchBar Component
 * Fuzzy search for graph nodes using Fuse.js
 * @module features/graph/components/SearchBar
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { cn } from '@/shared/utils';
import type { GraphNode, GraphNodeType } from '../types';
import { nodeColors, nodeTypeLabels, nodeTypeIcons } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface SearchBarProps {
  /** All nodes available for search */
  nodes: GraphNode[];
  /** Callback when a node is selected from results */
  onSelect: (nodeId: string) => void;
  /** Current search query */
  query: string;
  /** Callback when query changes */
  onQueryChange: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
}

interface SearchResult {
  item: GraphNode;
  score: number;
  matches?: Array<{
    key: string;
    indices: Array<[number, number]>;
  }>;
}

// ============================================================================
// Fuse Configuration
// ============================================================================

const FUSE_OPTIONS: Fuse.IFuseOptions<GraphNode> = {
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'type', weight: 0.2 },
    { name: 'location.filePath', weight: 0.1 },
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
};

// ============================================================================
// Component
// ============================================================================

/**
 * Search bar with fuzzy matching for graph nodes
 *
 * @example
 * <SearchBar
 *   nodes={graphNodes}
 *   onSelect={(nodeId) => focusNode(nodeId)}
 *   query={searchQuery}
 *   onQueryChange={setSearchQuery}
 * />
 */
function SearchBarComponent({
  nodes,
  onSelect,
  query,
  onQueryChange,
  placeholder = 'Search nodes...',
  className,
}: SearchBarProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Create Fuse instance
  const fuse = useMemo(() => new Fuse(nodes, FUSE_OPTIONS), [nodes]);

  // Search results
  const results: SearchResult[] = useMemo(() => {
    if (!query || query.length < 2) return [];

    const searchResults = fuse.search(query, { limit: 10 });
    return searchResults.map((result) => ({
      item: result.item,
      score: result.score ?? 0,
      matches: result.matches as SearchResult['matches'],
    }));
  }, [fuse, query]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) {
        if (e.key === 'Escape') {
          setIsOpen(false);
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (results[highlightedIndex]) {
            onSelect(results[highlightedIndex].item.id);
            setIsOpen(false);
            inputRef.current?.blur();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, results, highlightedIndex, onSelect]
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onQueryChange(value);
      setIsOpen(value.length >= 2);
    },
    [onQueryChange]
  );

  // Handle result click
  const handleResultClick = useCallback(
    (nodeId: string) => {
      onSelect(nodeId);
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  // Handle focus/blur
  const handleFocus = useCallback(() => {
    if (query.length >= 2 && results.length > 0) {
      setIsOpen(true);
    }
  }, [query, results.length]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Delay closing to allow click on result
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('[data-search-results]')) {
      setTimeout(() => setIsOpen(false), 200);
    }
  }, []);

  // Clear search
  const handleClear = useCallback(() => {
    onQueryChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onQueryChange]);

  return (
    <div className={cn('relative w-80', className)}>
      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            'w-full pl-9 pr-9 py-2 text-sm',
            'rounded-lg border border-gray-200 bg-white shadow-sm',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'transition-shadow'
          )}
          aria-label="Search nodes"
          aria-expanded={isOpen}
          aria-controls="search-results"
          aria-autocomplete="list"
          role="combobox"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          id="search-results"
          data-search-results
          role="listbox"
          className={cn(
            'absolute z-50 mt-1 w-full max-h-80 overflow-auto',
            'rounded-lg border border-gray-200 bg-white shadow-lg',
            'divide-y divide-gray-100'
          )}
        >
          {results.map((result, index) => {
            const node = result.item;
            const isHighlighted = index === highlightedIndex;
            const color = nodeColors[node.type];
            const icon = nodeTypeIcons[node.type];
            const label = nodeTypeLabels[node.type];

            return (
              <li
                key={node.id}
                role="option"
                aria-selected={isHighlighted}
                className={cn(
                  'flex items-start gap-3 px-3 py-2 cursor-pointer',
                  'transition-colors',
                  isHighlighted ? 'bg-primary-50' : 'hover:bg-gray-50'
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleResultClick(node.id)}
              >
                {/* Node Type Icon */}
                <div
                  className="mt-0.5 flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-base"
                  style={{ backgroundColor: color + '20' }}
                >
                  {icon}
                </div>

                {/* Node Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {highlightMatch(node.name, result.matches, 'name')}
                    </span>
                    <span
                      className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: color + '20', color }}
                    >
                      {label}
                    </span>
                  </div>

                  {/* File Location */}
                  {node.location && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {node.location.filePath.split('/').pop()}:
                      {node.location.startLine}
                    </div>
                  )}
                </div>

                {/* Match Score Indicator */}
                <div
                  className="flex-shrink-0 w-1 h-8 rounded-full"
                  style={{
                    backgroundColor: getScoreColor(result.score),
                  }}
                  title={`Match score: ${Math.round((1 - result.score) * 100)}%`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* No Results Message */}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-full py-4 px-3 text-center',
            'rounded-lg border border-gray-200 bg-white shadow-lg'
          )}
        >
          <p className="text-sm text-gray-500">No nodes found matching &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Highlight matched characters in text
 */
function highlightMatch(
  text: string,
  matches: SearchResult['matches'],
  key: string
): JSX.Element {
  const match = matches?.find((m) => m.key === key);
  if (!match) return <>{text}</>;

  const indices = match.indices;
  const parts: JSX.Element[] = [];
  let lastIndex = 0;

  indices.forEach(([start, end], i) => {
    // Add non-highlighted part
    if (start > lastIndex) {
      parts.push(
        <span key={`text-${i}`}>{text.slice(lastIndex, start)}</span>
      );
    }
    // Add highlighted part
    parts.push(
      <mark key={`match-${i}`} className="bg-amber-200 rounded px-0.5">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

/**
 * Get color based on match score (lower is better)
 */
function getScoreColor(score: number): string {
  if (score < 0.1) return '#22C55E'; // Green - excellent match
  if (score < 0.2) return '#84CC16'; // Lime - very good
  if (score < 0.3) return '#EAB308'; // Yellow - good
  return '#F97316'; // Orange - okay match
}

// ============================================================================
// Icons
// ============================================================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
      />
    </svg>
  );
}

export const SearchBar = memo(SearchBarComponent);

export type { SearchBarProps };
