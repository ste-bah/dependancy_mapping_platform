/**
 * useGraphUrlState Hook Tests
 * Tests for URL parameter synchronization hook
 * @module features/graph/__tests__/hooks/useGraphUrlState.test
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGraphUrlState, type UseGraphUrlStateOptions } from '../../hooks/useGraphUrlState';
import { defaultGraphFilters, ALL_NODE_TYPES } from '../../types';
import { URL_PARAM_KEYS } from '../../utils/constants';

// Mock react-router-dom hooks
const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useLocation: () => ({ pathname: '/test', search: '' }),
  };
});

describe('useGraphUrlState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearchParams.delete(URL_PARAM_KEYS.nodeTypes);
    mockSearchParams.delete(URL_PARAM_KEYS.search);
    mockSearchParams.delete(URL_PARAM_KEYS.blastRadius);
    mockSearchParams.delete(URL_PARAM_KEYS.selected);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter>{children}</MemoryRouter>;
  }

  describe('initialization', () => {
    it('should initialize with default filters', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      expect(result.current.filters).toEqual(defaultGraphFilters);
      expect(result.current.selectedNodeId).toBeNull();
    });

    it('should parse filters from URL params', () => {
      mockSearchParams.set(URL_PARAM_KEYS.nodeTypes, 'terraform_resource,helm_chart');
      mockSearchParams.set(URL_PARAM_KEYS.search, 'database');
      mockSearchParams.set(URL_PARAM_KEYS.blastRadius, 'true');

      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      expect(result.current.filters.nodeTypes).toContain('terraform_resource');
      expect(result.current.filters.nodeTypes).toContain('helm_chart');
      expect(result.current.filters.search).toBe('database');
      expect(result.current.filters.showBlastRadius).toBe(true);
    });

    it('should parse selected node from URL', () => {
      mockSearchParams.set(URL_PARAM_KEYS.selected, 'node-123');

      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      expect(result.current.selectedNodeId).toBe('node-123');
    });

    it('should merge with default filters provided in options', () => {
      const options: UseGraphUrlStateOptions = {
        defaultFilters: {
          nodeTypes: ['terraform_resource'],
          showBlastRadius: true,
        },
      };

      const { result } = renderHook(() => useGraphUrlState(options), { wrapper });

      expect(result.current.filters.nodeTypes).toEqual(['terraform_resource']);
      expect(result.current.filters.showBlastRadius).toBe(true);
    });
  });

  describe('setFilters', () => {
    it('should update filters state', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setFilters({
          ...defaultGraphFilters,
          search: 'new search',
        });
      });

      expect(result.current.filters.search).toBe('new search');
    });

    it('should update URL after debounce', async () => {
      const { result } = renderHook(() => useGraphUrlState({ debounceMs: 100 }), {
        wrapper,
      });

      act(() => {
        result.current.setFilters({
          ...defaultGraphFilters,
          search: 'test',
        });
      });

      // URL not updated yet
      expect(mockSetSearchParams).not.toHaveBeenCalled();

      // Fast forward past debounce
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(mockSetSearchParams).toHaveBeenCalled();
    });
  });

  describe('updateFilters', () => {
    it('should merge partial updates', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.updateFilters({ search: 'partial update' });
      });

      expect(result.current.filters.search).toBe('partial update');
      // Other filters should remain unchanged
      expect(result.current.filters.showBlastRadius).toBe(false);
    });
  });

  describe('setNodeTypes', () => {
    it('should update node types', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setNodeTypes(['terraform_resource', 'helm_chart']);
      });

      expect(result.current.filters.nodeTypes).toEqual(['terraform_resource', 'helm_chart']);
    });
  });

  describe('toggleNodeType', () => {
    it('should add node type if not present', () => {
      const { result } = renderHook(
        () =>
          useGraphUrlState({
            defaultFilters: { nodeTypes: ['terraform_resource'] },
          }),
        { wrapper }
      );

      act(() => {
        result.current.toggleNodeType('helm_chart');
      });

      expect(result.current.filters.nodeTypes).toContain('terraform_resource');
      expect(result.current.filters.nodeTypes).toContain('helm_chart');
    });

    it('should remove node type if present', () => {
      const { result } = renderHook(
        () =>
          useGraphUrlState({
            defaultFilters: { nodeTypes: ['terraform_resource', 'helm_chart'] },
          }),
        { wrapper }
      );

      act(() => {
        result.current.toggleNodeType('helm_chart');
      });

      expect(result.current.filters.nodeTypes).toContain('terraform_resource');
      expect(result.current.filters.nodeTypes).not.toContain('helm_chart');
    });

    it('should not remove last node type', () => {
      const { result } = renderHook(
        () =>
          useGraphUrlState({
            defaultFilters: { nodeTypes: ['terraform_resource'] },
          }),
        { wrapper }
      );

      act(() => {
        result.current.toggleNodeType('terraform_resource');
      });

      // Should still have the type
      expect(result.current.filters.nodeTypes).toContain('terraform_resource');
    });
  });

  describe('setSearch', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setSearch('new query');
      });

      expect(result.current.filters.search).toBe('new query');
    });
  });

  describe('toggleBlastRadius', () => {
    it('should toggle blast radius on', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      expect(result.current.filters.showBlastRadius).toBe(false);

      act(() => {
        result.current.toggleBlastRadius();
      });

      expect(result.current.filters.showBlastRadius).toBe(true);
    });

    it('should toggle blast radius off', () => {
      const { result } = renderHook(
        () =>
          useGraphUrlState({
            defaultFilters: { showBlastRadius: true },
          }),
        { wrapper }
      );

      expect(result.current.filters.showBlastRadius).toBe(true);

      act(() => {
        result.current.toggleBlastRadius();
      });

      expect(result.current.filters.showBlastRadius).toBe(false);
    });
  });

  describe('setSelectedNodeId', () => {
    it('should update selected node', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setSelectedNodeId('node-456');
      });

      expect(result.current.selectedNodeId).toBe('node-456');
    });

    it('should clear selected node with null', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setSelectedNodeId('node-456');
      });

      act(() => {
        result.current.setSelectedNodeId(null);
      });

      expect(result.current.selectedNodeId).toBeNull();
    });

    it('should call onSelectionChange callback', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(
        () => useGraphUrlState({ onSelectionChange }),
        { wrapper }
      );

      act(() => {
        result.current.setSelectedNodeId('node-789');
      });

      expect(onSelectionChange).toHaveBeenCalledWith('node-789');
    });
  });

  describe('resetFilters', () => {
    it('should reset to default filters', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      // Modify filters
      act(() => {
        result.current.setSearch('some search');
        result.current.toggleBlastRadius();
      });

      // Reset
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.showBlastRadius).toBe(false);
    });

    it('should reset to custom default filters', () => {
      const customDefaults = {
        nodeTypes: ['terraform_resource'] as const,
        showBlastRadius: true,
      };

      const { result } = renderHook(
        () => useGraphUrlState({ defaultFilters: customDefaults }),
        { wrapper }
      );

      act(() => {
        result.current.setSearch('temporary');
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.nodeTypes).toEqual(['terraform_resource']);
      expect(result.current.filters.showBlastRadius).toBe(true);
    });
  });

  describe('clearUrlState', () => {
    it('should clear all state', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setSearch('test');
        result.current.setSelectedNodeId('node-1');
      });

      act(() => {
        result.current.clearUrlState();
      });

      expect(result.current.filters.search).toBe('');
      expect(result.current.selectedNodeId).toBeNull();
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false when filters match defaults', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should return true when search is active', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setSearch('active search');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when node types differ', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when blast radius is enabled', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.toggleBlastRadius();
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe('hiddenNodeTypeCount', () => {
    it('should return 0 when all types visible', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      expect(result.current.hiddenNodeTypeCount).toBe(0);
    });

    it('should count hidden types', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setNodeTypes(['terraform_resource']);
      });

      expect(result.current.hiddenNodeTypeCount).toBe(ALL_NODE_TYPES.length - 1);
    });
  });

  describe('getShareableUrl', () => {
    it('should generate shareable URL', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      act(() => {
        result.current.setSearch('test');
        result.current.setSelectedNodeId('node-1');
      });

      const url = result.current.getShareableUrl();

      expect(url).toContain('q=test');
      expect(url).toContain('node=node-1');
    });

    it('should return base URL when no filters active', () => {
      const { result } = renderHook(() => useGraphUrlState(), { wrapper });

      const url = result.current.getShareableUrl();

      // Should just be the base path without query params
      expect(url).toMatch(/^http.*\/test$/);
    });
  });

  describe('callbacks', () => {
    it('should call onFiltersChange when filters update', () => {
      const onFiltersChange = vi.fn();
      const { result } = renderHook(
        () => useGraphUrlState({ onFiltersChange }),
        { wrapper }
      );

      act(() => {
        result.current.setSearch('callback test');
      });

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'callback test',
        })
      );
    });
  });

  describe('enabled option', () => {
    it('should not update URL when disabled', () => {
      const { result } = renderHook(
        () => useGraphUrlState({ enabled: false }),
        { wrapper }
      );

      act(() => {
        result.current.setSearch('disabled test');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockSetSearchParams).not.toHaveBeenCalled();
    });
  });

  describe('viewport sync', () => {
    it('should sync viewport when enabled', () => {
      mockSearchParams.set(URL_PARAM_KEYS.viewX, '100');
      mockSearchParams.set(URL_PARAM_KEYS.viewY, '200');
      mockSearchParams.set(URL_PARAM_KEYS.zoom, '1.5');

      const { result } = renderHook(
        () => useGraphUrlState({ syncViewport: true }),
        { wrapper }
      );

      expect(result.current.viewport).toEqual({
        x: 100,
        y: 200,
        zoom: 1.5,
      });
    });

    it('should update viewport state', () => {
      const { result } = renderHook(
        () => useGraphUrlState({ syncViewport: true }),
        { wrapper }
      );

      act(() => {
        result.current.setViewport({ x: 50, y: 75, zoom: 0.8 });
      });

      expect(result.current.viewport).toEqual({
        x: 50,
        y: 75,
        zoom: 0.8,
      });
    });
  });
});
