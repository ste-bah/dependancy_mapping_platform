/**
 * URL State Tests
 * Tests for URL parameter serialization/deserialization
 * @module features/graph/__tests__/utils/urlState.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  filtersToSearchParams,
  extendedFiltersToSearchParams,
  searchParamsToFilters,
  searchParamsToExtendedFilters,
  selectedNodeToParam,
  paramToSelectedNode,
  viewportToSearchParams,
  searchParamsToViewport,
  stateToSearchParams,
  extendedStateToSearchParams,
  searchParamsToState,
  searchParamsToExtendedState,
  updateUrlParams,
  getCurrentUrlParams,
  mergeUrlParams,
  clearGraphUrlParams,
} from '../../utils/urlState';
import { createMockFilters, createMockExtendedFilters } from './testUtils';
import { URL_PARAM_KEYS } from '../../utils/constants';
import type { GraphFilters, ExtendedGraphFilters, GraphViewState } from '../../types';

describe('urlState', () => {
  beforeEach(() => {
    // Reset window.location.search for tests that use it
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/',
        pathname: '/',
        search: '',
        hash: '',
      },
      writable: true,
    });
  });

  describe('filtersToSearchParams', () => {
    it('should return empty params for default filters', () => {
      const filters = createMockFilters();
      const params = filtersToSearchParams(filters);

      // When all node types are selected and no search, params should be empty
      expect(params.toString()).toBe('');
    });

    it('should serialize node types when subset is selected', () => {
      const filters = createMockFilters({
        nodeTypes: ['terraform_resource', 'helm_chart'],
      });

      const params = filtersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.nodeTypes)).toBe('terraform_resource,helm_chart');
    });

    it('should serialize search query', () => {
      const filters = createMockFilters({ search: 'database' });

      const params = filtersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.search)).toBe('database');
    });

    it('should trim search query', () => {
      const filters = createMockFilters({ search: '  trimmed  ' });

      const params = filtersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.search)).toBe('trimmed');
    });

    it('should not include empty search', () => {
      const filters = createMockFilters({ search: '' });

      const params = filtersToSearchParams(filters);

      expect(params.has(URL_PARAM_KEYS.search)).toBe(false);
    });

    it('should serialize showBlastRadius when true', () => {
      const filters = createMockFilters({ showBlastRadius: true });

      const params = filtersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.blastRadius)).toBe('true');
    });

    it('should not include showBlastRadius when false', () => {
      const filters = createMockFilters({ showBlastRadius: false });

      const params = filtersToSearchParams(filters);

      expect(params.has(URL_PARAM_KEYS.blastRadius)).toBe(false);
    });
  });

  describe('extendedFiltersToSearchParams', () => {
    it('should include base filters', () => {
      const filters = createMockExtendedFilters({
        search: 'test',
        showBlastRadius: true,
      });

      const params = extendedFiltersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.search)).toBe('test');
      expect(params.get(URL_PARAM_KEYS.blastRadius)).toBe('true');
    });

    it('should serialize edge types when subset', () => {
      const filters = createMockExtendedFilters({
        edgeTypes: ['DEPENDS_ON', 'REFERENCES'],
      });

      const params = extendedFiltersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.edgeTypes)).toBe('DEPENDS_ON,REFERENCES');
    });

    it('should serialize minConfidence when non-zero', () => {
      const filters = createMockExtendedFilters({ minConfidence: 0.5 });

      const params = extendedFiltersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.minConfidence)).toBe('0.5');
    });

    it('should not include zero minConfidence', () => {
      const filters = createMockExtendedFilters({ minConfidence: 0 });

      const params = extendedFiltersToSearchParams(filters);

      expect(params.has(URL_PARAM_KEYS.minConfidence)).toBe(false);
    });

    it('should serialize maxDepth when finite', () => {
      const filters = createMockExtendedFilters({ maxDepth: 5 });

      const params = extendedFiltersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.maxDepth)).toBe('5');
    });

    it('should not include Infinity maxDepth', () => {
      const filters = createMockExtendedFilters({ maxDepth: Infinity });

      const params = extendedFiltersToSearchParams(filters);

      expect(params.has(URL_PARAM_KEYS.maxDepth)).toBe(false);
    });

    it('should serialize showConnectedOnly when true', () => {
      const filters = createMockExtendedFilters({ showConnectedOnly: true });

      const params = extendedFiltersToSearchParams(filters);

      expect(params.get(URL_PARAM_KEYS.connectedOnly)).toBe('true');
    });
  });

  describe('searchParamsToFilters', () => {
    it('should return defaults for empty params', () => {
      const params = new URLSearchParams();

      const filters = searchParamsToFilters(params);

      expect(filters.nodeTypes).toBeDefined();
      expect(filters.search).toBe('');
      expect(filters.showBlastRadius).toBe(false);
    });

    it('should parse node types', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.nodeTypes, 'terraform_resource,helm_chart');

      const filters = searchParamsToFilters(params);

      expect(filters.nodeTypes).toEqual(['terraform_resource', 'helm_chart']);
    });

    it('should filter invalid node types', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.nodeTypes, 'terraform_resource,invalid_type,helm_chart');

      const filters = searchParamsToFilters(params);

      expect(filters.nodeTypes).toEqual(['terraform_resource', 'helm_chart']);
      expect(filters.nodeTypes).not.toContain('invalid_type');
    });

    it('should use defaults when all types are invalid', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.nodeTypes, 'invalid1,invalid2');

      const filters = searchParamsToFilters(params);

      // Should fall back to defaults
      expect(filters.nodeTypes.length).toBeGreaterThan(0);
    });

    it('should parse search query', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.search, 'my search');

      const filters = searchParamsToFilters(params);

      expect(filters.search).toBe('my search');
    });

    it('should parse showBlastRadius', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.blastRadius, 'true');

      const filters = searchParamsToFilters(params);

      expect(filters.showBlastRadius).toBe(true);
    });
  });

  describe('searchParamsToExtendedFilters', () => {
    it('should include base filter parsing', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.search, 'test');

      const filters = searchParamsToExtendedFilters(params);

      expect(filters.search).toBe('test');
    });

    it('should parse edge types', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.edgeTypes, 'DEPENDS_ON,CONTAINS');

      const filters = searchParamsToExtendedFilters(params);

      expect(filters.edgeTypes).toEqual(['DEPENDS_ON', 'CONTAINS']);
    });

    it('should filter invalid edge types', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.edgeTypes, 'DEPENDS_ON,INVALID');

      const filters = searchParamsToExtendedFilters(params);

      expect(filters.edgeTypes).toEqual(['DEPENDS_ON']);
    });

    it('should parse minConfidence', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.minConfidence, '0.75');

      const filters = searchParamsToExtendedFilters(params);

      expect(filters.minConfidence).toBe(0.75);
    });

    it('should ignore out of range minConfidence', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.minConfidence, '1.5');

      const filters = searchParamsToExtendedFilters(params);

      // Should use default instead
      expect(filters.minConfidence).toBe(0);
    });

    it('should parse maxDepth', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.maxDepth, '10');

      const filters = searchParamsToExtendedFilters(params);

      expect(filters.maxDepth).toBe(10);
    });

    it('should ignore non-positive maxDepth', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.maxDepth, '-1');

      const filters = searchParamsToExtendedFilters(params);

      expect(filters.maxDepth).toBe(Infinity);
    });

    it('should parse showConnectedOnly', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.connectedOnly, 'true');

      const filters = searchParamsToExtendedFilters(params);

      expect(filters.showConnectedOnly).toBe(true);
    });
  });

  describe('selectedNodeToParam / paramToSelectedNode', () => {
    it('should convert node ID to param value', () => {
      expect(selectedNodeToParam('node-123')).toBe('node-123');
      expect(selectedNodeToParam(null)).toBe('');
    });

    it('should convert param value to node ID', () => {
      expect(paramToSelectedNode('node-123')).toBe('node-123');
      expect(paramToSelectedNode(null)).toBeNull();
      expect(paramToSelectedNode('')).toBeNull();
      expect(paramToSelectedNode('  ')).toBeNull();
    });

    it('should trim param value', () => {
      expect(paramToSelectedNode('  node-123  ')).toBe('node-123');
    });
  });

  describe('viewportToSearchParams / searchParamsToViewport', () => {
    it('should serialize viewport', () => {
      const viewport: GraphViewState = { x: 100.123, y: 200.456, zoom: 1.5 };

      const params = viewportToSearchParams(viewport);

      expect(params.get(URL_PARAM_KEYS.viewX)).toBe('100.12');
      expect(params.get(URL_PARAM_KEYS.viewY)).toBe('200.46');
      expect(params.get(URL_PARAM_KEYS.zoom)).toBe('1.50');
    });

    it('should deserialize viewport', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.viewX, '50');
      params.set(URL_PARAM_KEYS.viewY, '75');
      params.set(URL_PARAM_KEYS.zoom, '0.8');

      const viewport = searchParamsToViewport(params);

      expect(viewport.x).toBe(50);
      expect(viewport.y).toBe(75);
      expect(viewport.zoom).toBe(0.8);
    });

    it('should use defaults for missing values', () => {
      const params = new URLSearchParams();
      const defaults: GraphViewState = { x: 10, y: 20, zoom: 1 };

      const viewport = searchParamsToViewport(params, defaults);

      expect(viewport).toEqual(defaults);
    });
  });

  describe('stateToSearchParams / searchParamsToState', () => {
    it('should serialize complete state', () => {
      const state = {
        filters: createMockFilters({ search: 'test', showBlastRadius: true }),
        selectedNodeId: 'node-1',
        viewport: { x: 100, y: 200, zoom: 1.5 },
      };

      const params = stateToSearchParams(state);

      expect(params.get(URL_PARAM_KEYS.search)).toBe('test');
      expect(params.get(URL_PARAM_KEYS.blastRadius)).toBe('true');
      expect(params.get(URL_PARAM_KEYS.selected)).toBe('node-1');
      expect(params.get(URL_PARAM_KEYS.viewX)).toBe('100.00');
    });

    it('should deserialize complete state', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.search, 'query');
      params.set(URL_PARAM_KEYS.selected, 'selected-node');
      params.set(URL_PARAM_KEYS.viewX, '50');
      params.set(URL_PARAM_KEYS.viewY, '100');
      params.set(URL_PARAM_KEYS.zoom, '0.75');

      const state = searchParamsToState(params);

      expect(state.filters.search).toBe('query');
      expect(state.selectedNodeId).toBe('selected-node');
      expect(state.viewport).toEqual({ x: 50, y: 100, zoom: 0.75 });
    });

    it('should not include viewport when params missing', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.search, 'test');

      const state = searchParamsToState(params);

      expect(state.viewport).toBeUndefined();
    });
  });

  describe('extendedStateToSearchParams / searchParamsToExtendedState', () => {
    it('should serialize extended state', () => {
      const state = {
        filters: createMockExtendedFilters({
          minConfidence: 0.5,
          maxDepth: 3,
        }),
        selectedNodeId: 'node-ext',
      };

      const params = extendedStateToSearchParams(state);

      expect(params.get(URL_PARAM_KEYS.minConfidence)).toBe('0.5');
      expect(params.get(URL_PARAM_KEYS.maxDepth)).toBe('3');
      expect(params.get(URL_PARAM_KEYS.selected)).toBe('node-ext');
    });

    it('should deserialize extended state', () => {
      const params = new URLSearchParams();
      params.set(URL_PARAM_KEYS.minConfidence, '0.8');
      params.set(URL_PARAM_KEYS.connectedOnly, 'true');

      const state = searchParamsToExtendedState(params);

      expect(state.filters.minConfidence).toBe(0.8);
      expect(state.filters.showConnectedOnly).toBe(true);
    });
  });

  describe('updateUrlParams', () => {
    it('should push new history entry by default', () => {
      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      const params = new URLSearchParams();
      params.set('test', 'value');

      updateUrlParams(params, false);

      expect(pushStateSpy).toHaveBeenCalled();
      pushStateSpy.mockRestore();
    });

    it('should replace history entry when replace is true', () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      const params = new URLSearchParams();
      params.set('test', 'value');

      updateUrlParams(params, true);

      expect(replaceStateSpy).toHaveBeenCalled();
      replaceStateSpy.mockRestore();
    });
  });

  describe('getCurrentUrlParams', () => {
    it('should return current URL search params', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?foo=bar&baz=qux' },
        writable: true,
      });

      const params = getCurrentUrlParams();

      expect(params.get('foo')).toBe('bar');
      expect(params.get('baz')).toBe('qux');
    });
  });

  describe('mergeUrlParams', () => {
    it('should merge new values into existing params', () => {
      const current = new URLSearchParams();
      current.set('existing', 'value');

      const merged = mergeUrlParams({ new: 'param' }, current);

      expect(merged.get('existing')).toBe('value');
      expect(merged.get('new')).toBe('param');
    });

    it('should remove params with null value', () => {
      const current = new URLSearchParams();
      current.set('toRemove', 'value');
      current.set('toKeep', 'value');

      const merged = mergeUrlParams({ toRemove: null }, current);

      expect(merged.has('toRemove')).toBe(false);
      expect(merged.has('toKeep')).toBe(true);
    });

    it('should remove params with empty string value', () => {
      const current = new URLSearchParams();
      current.set('toRemove', 'value');

      const merged = mergeUrlParams({ toRemove: '' }, current);

      expect(merged.has('toRemove')).toBe(false);
    });
  });

  describe('clearGraphUrlParams', () => {
    it('should remove all graph-related params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: `?${URL_PARAM_KEYS.search}=test&${URL_PARAM_KEYS.selected}=node&other=keep`,
        },
        writable: true,
      });

      const cleared = clearGraphUrlParams();

      expect(cleared.has(URL_PARAM_KEYS.search)).toBe(false);
      expect(cleared.has(URL_PARAM_KEYS.selected)).toBe(false);
      expect(cleared.get('other')).toBe('keep');
    });
  });
});
