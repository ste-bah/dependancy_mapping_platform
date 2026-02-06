/**
 * SearchBar Component Tests
 * Tests for the fuzzy search bar component
 * @module features/graph/__tests__/components/SearchBar.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../../components/SearchBar';
import { renderWithProviders, createMockNode, createMockNodes } from '../utils/testUtils';
import type { GraphNode } from '../../types';
import { nodeTypeLabels } from '../../types';

// Mock Fuse.js - create a mock class that mimics Fuse behavior
vi.mock('fuse.js', () => {
  class MockFuse<T> {
    private items: T[];

    constructor(items: T[]) {
      this.items = items;
    }

    search(query: string): Array<{ item: T; score: number; matches: Array<{ key: string; indices: Array<[number, number]> }> }> {
      if (!query) return [];
      return this.items
        .filter((item: any) =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.id.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 10)
        .map((item: T) => ({
          item,
          score: 0.1,
          matches: [{ key: 'name', indices: [[0, query.length - 1]] as [number, number][] }],
        }));
    }
  }

  return { default: MockFuse };
});

// Mock cn utility
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) =>
    classes.filter(Boolean).join(' '),
}));

// Mock scrollIntoView for JSDOM
Element.prototype.scrollIntoView = vi.fn();

describe('SearchBar', () => {
  const mockNodes: GraphNode[] = [
    createMockNode({ id: 'node-1', name: 'aws_vpc_main' }),
    createMockNode({ id: 'node-2', name: 'aws_subnet_private' }),
    createMockNode({ id: 'node-3', name: 'aws_s3_bucket' }),
    createMockNode({ id: 'node-4', name: 'helm_ingress_controller' }),
    createMockNode({ id: 'node-5', name: 'k8s_deployment_api' }),
  ];

  const defaultProps = {
    nodes: mockNodes,
    onSelect: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render search input', () => {
      renderWithProviders(<SearchBar {...defaultProps} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show placeholder text', () => {
      renderWithProviders(<SearchBar {...defaultProps} placeholder="Search nodes..." />);

      expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    });

    it('should show current query value', () => {
      renderWithProviders(<SearchBar {...defaultProps} query="vpc" />);

      expect(screen.getByRole('combobox')).toHaveValue('vpc');
    });

    it('should apply custom className', () => {
      const { container } = renderWithProviders(
        <SearchBar {...defaultProps} className="custom-search" />
      );

      expect(container.firstChild).toHaveClass('custom-search');
    });
  });

  describe('search functionality', () => {
    it('should call onQueryChange when typing', async () => {
      const onQueryChange = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <SearchBar {...defaultProps} onQueryChange={onQueryChange} />
      );

      await user.type(screen.getByRole('combobox'), 'aws');

      expect(onQueryChange).toHaveBeenCalled();
    });

    it('should show results when query is 2+ characters', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aw" />);

      // Focus should trigger results if query length >= 2
      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should not show results for single character', () => {
      renderWithProviders(<SearchBar {...defaultProps} query="a" />);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should show no results message when nothing matches', async () => {
      // Controlled component wrapper that actually updates the query
      const ControlledSearchBar = () => {
        const [query, setQuery] = React.useState('');
        return (
          <SearchBar
            {...defaultProps}
            query={query}
            onQueryChange={setQuery}
          />
        );
      };

      const user = userEvent.setup();
      renderWithProviders(<ControlledSearchBar />);

      const input = screen.getByRole('combobox');

      // Type a query that won't match anything (need at least 2 chars)
      await user.type(input, 'xyz');

      await waitFor(() => {
        // The message format is "No nodes found matching "xyz""
        expect(screen.getByText(/no nodes found matching/i)).toBeInTheDocument();
      });
    });
  });

  describe('result selection', () => {
    it('should call onSelect when clicking a result', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <SearchBar {...defaultProps} query="vpc" onSelect={onSelect} />
      );

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const option = screen.getAllByRole('option')[0];
      await user.click(option);

      expect(onSelect).toHaveBeenCalledWith('node-1');
    });

    it('should close dropdown after selection', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="vpc" />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const option = screen.getAllByRole('option')[0];
      await user.click(option);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should highlight next item on ArrowDown', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aws" />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should highlight previous item on ArrowUp', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aws" />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Move down twice then up once
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap around at the end', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aws" />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Move past the end - starting at 0, pressing options.length times wraps back to 0
      const options = screen.getAllByRole('option');
      for (let i = 0; i < options.length; i++) {
        await user.keyboard('{ArrowDown}');
      }

      // Should wrap to first (0 -> 1 -> 2 -> 0 with 3 items)
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('should select highlighted item on Enter', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <SearchBar {...defaultProps} query="vpc" onSelect={onSelect} />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalled();
    });

    it('should close dropdown on Escape', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aws" />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('clear button', () => {
    it('should show clear button when query has value', () => {
      renderWithProviders(<SearchBar {...defaultProps} query="test" />);

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should not show clear button when query is empty', () => {
      renderWithProviders(<SearchBar {...defaultProps} query="" />);

      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });

    it('should clear query and focus input when clicked', async () => {
      const onQueryChange = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <SearchBar {...defaultProps} query="test" onQueryChange={onQueryChange} />
      );

      await user.click(screen.getByRole('button', { name: /clear/i }));

      expect(onQueryChange).toHaveBeenCalledWith('');
    });
  });

  describe('result display', () => {
    it('should show node name in results', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="vpc" />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        // The name may be split across elements due to highlighting, so use a function matcher
        expect(
          screen.getByText((content, element) => {
            return element?.tagName === 'SPAN' && element?.textContent === 'aws_vpc_main';
          })
        ).toBeInTheDocument();
      });
    });

    it('should show node type badge', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="vpc" />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        // The label uses nodeTypeLabels which is "TF Resource" for terraform_resource
        expect(screen.getByText(nodeTypeLabels.terraform_resource)).toBeInTheDocument();
      });
    });

    it('should show file location when present', async () => {
      const nodesWithLocation = [
        createMockNode({
          id: 'node-1',
          name: 'test_resource',
          location: { filePath: '/modules/main.tf', startLine: 10, endLine: 20 },
        }),
      ];

      const user = userEvent.setup();

      renderWithProviders(
        <SearchBar {...defaultProps} nodes={nodesWithLocation} query="test" />
      );

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText(/main\.tf/)).toBeInTheDocument();
      });
    });

    it('should highlight matching text', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="vpc" />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        const mark = screen.getByRole('listbox').querySelector('mark');
        expect(mark).toBeInTheDocument();
      });
    });

    it('should show match quality indicator', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="vpc" />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        // Score indicator should be present
        const scoreIndicator = screen.getByRole('listbox').querySelector('[title*="score"]');
        expect(scoreIndicator).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper aria attributes', () => {
      renderWithProviders(<SearchBar {...defaultProps} />);

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('should update aria-expanded when results shown', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aws" />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have accessible label', () => {
      renderWithProviders(<SearchBar {...defaultProps} />);

      expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Search nodes');
    });
  });

  describe('focus management', () => {
    it('should open dropdown on focus when query exists', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aws" />);

      await user.click(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should close dropdown on blur', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SearchBar {...defaultProps} query="aws" />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.tab();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });
});
