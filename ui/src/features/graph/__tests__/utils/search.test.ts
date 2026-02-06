/**
 * Search Logic Tests
 * Tests for Fuse.js based search utilities
 * @module features/graph/__tests__/utils/search.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSearchIndex,
  createFlowNodeSearchIndex,
  searchNodes,
  searchFlowNodes,
  highlightMatch,
  highlightSearchResult,
  quickSearch,
  quickSearchFlowNodes,
  isValidSearchQuery,
  normalizeQuery,
  getBestMatchField,
} from '../../utils/search';
import {
  createMockNode,
  createMockNodes,
  createMockFlowNodes,
  resetIdCounters,
} from './testUtils';
import type { GraphNode, FlowNode } from '../../types';

describe('search', () => {
  beforeEach(() => {
    resetIdCounters();
  });

  describe('createSearchIndex', () => {
    it('should create a Fuse.js index', () => {
      const nodes = createMockNodes(5);
      const fuse = createSearchIndex(nodes);

      expect(fuse).toBeDefined();
      expect(typeof fuse.search).toBe('function');
    });

    it('should accept custom options', () => {
      const nodes = createMockNodes(3);
      const fuse = createSearchIndex(nodes, {
        threshold: 0.1,
        keys: ['name'],
      });

      expect(fuse).toBeDefined();
    });
  });

  describe('createFlowNodeSearchIndex', () => {
    it('should create index for FlowNodes', () => {
      const nodes = createMockFlowNodes(createMockNodes(3));
      const fuse = createFlowNodeSearchIndex(nodes);

      expect(fuse).toBeDefined();
    });
  });

  describe('searchNodes', () => {
    it('should return empty array for empty query', () => {
      const nodes = createMockNodes(5);
      const fuse = createSearchIndex(nodes);

      expect(searchNodes(fuse, '')).toEqual([]);
      expect(searchNodes(fuse, '  ')).toEqual([]);
    });

    it('should return empty array for query shorter than min length', () => {
      const nodes = createMockNodes(5);
      const fuse = createSearchIndex(nodes);

      expect(searchNodes(fuse, 'a')).toEqual([]); // Default minQueryLength is 2
    });

    it('should find nodes by name', () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: 'n1', name: 'aws_s3_bucket' }),
        createMockNode({ id: 'n2', name: 'aws_rds_instance' }),
        createMockNode({ id: 'n3', name: 'helm_deployment' }),
      ];
      const fuse = createSearchIndex(nodes);

      const results = searchNodes(fuse, 's3');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].node.name).toContain('s3');
    });

    it('should find nodes by id', () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: 'terraform-main-vpc', name: 'VPC', type: 'terraform_resource' }),
        createMockNode({ id: 'helm-ingress', name: 'Ingress', type: 'helm_chart' }),
      ];
      const fuse = createSearchIndex(nodes);

      const results = searchNodes(fuse, 'terraform');

      expect(results.length).toBe(1);
      expect(results[0].node.id).toBe('terraform-main-vpc');
    });

    it('should find nodes by type', () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: 'n1', name: 'Resource', type: 'helm_chart' }),
        createMockNode({ id: 'n2', name: 'Other', type: 'terraform_resource' }),
      ];
      const fuse = createSearchIndex(nodes);

      const results = searchNodes(fuse, 'helm');

      expect(results.length).toBe(1);
      expect(results[0].node.type).toBe('helm_chart');
    });

    it('should find nodes by file path', () => {
      const nodes: GraphNode[] = [
        createMockNode({
          id: 'n1',
          name: 'Resource',
          location: { filePath: '/modules/networking/vpc.tf', startLine: 1, endLine: 10 },
        }),
        createMockNode({
          id: 'n2',
          name: 'Other',
          location: { filePath: '/modules/compute/ec2.tf', startLine: 1, endLine: 10 },
        }),
      ];
      const fuse = createSearchIndex(nodes);

      const results = searchNodes(fuse, 'networking');

      expect(results.length).toBe(1);
      expect(results[0].node.location?.filePath).toContain('networking');
    });

    it('should respect maxResults limit', () => {
      const nodes = createMockNodes(20);
      const fuse = createSearchIndex(nodes);

      const results = searchNodes(fuse, 'node', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should include match information', () => {
      const nodes = [createMockNode({ id: 'test-node', name: 'database-primary' })];
      const fuse = createSearchIndex(nodes);

      const results = searchNodes(fuse, 'database');

      expect(results.length).toBe(1);
      expect(results[0].score).toBeDefined();
      expect(results[0].matches).toBeDefined();
    });

    it('should sort by relevance score', () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: 'partial-match', name: 'some-database-resource' }),
        createMockNode({ id: 'exact-match', name: 'database' }),
      ];
      const fuse = createSearchIndex(nodes);

      const results = searchNodes(fuse, 'database');

      expect(results.length).toBe(2);
      // Better match should be first (lower score)
      expect(results[0].score).toBeLessThanOrEqual(results[1].score);
    });
  });

  describe('searchFlowNodes', () => {
    it('should search FlowNodes by data properties', () => {
      const graphNodes = [
        createMockNode({ name: 'vpc-main' }),
        createMockNode({ name: 'subnet-private' }),
      ];
      const flowNodes = createMockFlowNodes(graphNodes);
      const fuse = createFlowNodeSearchIndex(flowNodes);

      const results = searchFlowNodes(fuse, 'vpc');

      expect(results.length).toBe(1);
      expect(results[0].node.data.name).toContain('vpc');
    });
  });

  describe('highlightMatch', () => {
    it('should return original text when no indices', () => {
      expect(highlightMatch('hello', [])).toBe('hello');
    });

    it('should wrap matched portions with mark tag', () => {
      const result = highlightMatch('hello world', [[0, 4]]);

      expect(result).toBe('<mark>hello</mark> world');
    });

    it('should handle multiple match ranges', () => {
      const result = highlightMatch('hello world hello', [[0, 4], [12, 16]]);

      expect(result).toBe('<mark>hello</mark> world <mark>hello</mark>');
    });

    it('should merge overlapping ranges', () => {
      const result = highlightMatch('abcdefgh', [[0, 3], [2, 5]]);

      // Should merge [0,3] and [2,5] into [0,5]
      expect(result).toBe('<mark>abcdef</mark>gh');
    });

    it('should merge adjacent ranges', () => {
      const result = highlightMatch('abcdef', [[0, 1], [2, 3]]);

      // Adjacent [0,1] and [2,3] should merge
      expect(result).toBe('<mark>abcd</mark>ef');
    });

    it('should use custom tag', () => {
      const result = highlightMatch('test', [[0, 3]], 'strong');

      expect(result).toBe('<strong>test</strong>');
    });

    it('should escape HTML in text', () => {
      const result = highlightMatch('<script>alert("xss")</script>', [[0, 7]]);

      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should handle empty text', () => {
      expect(highlightMatch('', [[0, 1]])).toBe('');
    });

    it('should clamp indices to valid range', () => {
      const result = highlightMatch('abc', [[-1, 10]]);

      // Should clamp to valid range
      expect(result).toBe('<mark>abc</mark>');
    });
  });

  describe('highlightSearchResult', () => {
    it('should highlight matched field', () => {
      const result = {
        node: createMockNode({ name: 'database-main' }),
        score: 0.1,
        matches: [
          { key: 'name', value: 'database-main', indices: [[0, 7]] as unknown as readonly [number, number][] },
        ],
      };

      const highlighted = highlightSearchResult(result, 'name');

      expect(highlighted).toBe('<mark>database</mark>-main');
    });

    it('should return raw value when field not matched', () => {
      const result = {
        node: createMockNode({ name: 'test', type: 'helm_chart' }),
        score: 0.1,
        matches: [{ key: 'name', value: 'test', indices: [[0, 3]] as unknown as readonly [number, number][] }],
      };

      const highlighted = highlightSearchResult(result, 'type');

      expect(highlighted).toBe('helm_chart');
    });

    it('should handle location.filePath field', () => {
      const node = createMockNode({
        location: { filePath: '/path/to/file.tf', startLine: 1, endLine: 10 },
      });
      const result = {
        node,
        score: 0.1,
        matches: [],
      };

      const highlighted = highlightSearchResult(result, 'location.filePath');

      expect(highlighted).toBe('/path/to/file.tf');
    });
  });

  describe('quickSearch', () => {
    it('should return empty array for short query', () => {
      const nodes = createMockNodes(5);

      expect(quickSearch(nodes, '')).toEqual([]);
      expect(quickSearch(nodes, 'a')).toEqual([]);
    });

    it('should find matching nodes without index', () => {
      const nodes: GraphNode[] = [
        createMockNode({ name: 'database-primary' }),
        createMockNode({ name: 'api-gateway' }),
        createMockNode({ name: 'database-replica' }),
      ];

      const results = quickSearch(nodes, 'database');

      expect(results).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const nodes = [createMockNode({ name: 'DATABASE' })];

      const results = quickSearch(nodes, 'database');

      expect(results).toHaveLength(1);
    });

    it('should search across multiple fields', () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: 'searchable-id', name: 'Other Name' }),
        createMockNode({
          id: 'other',
          name: 'Name',
          location: { filePath: '/searchable/path.tf', startLine: 1, endLine: 1 },
        }),
      ];

      const results = quickSearch(nodes, 'searchable');

      expect(results).toHaveLength(2);
    });

    it('should respect maxResults', () => {
      const nodes = createMockNodes(10);

      const results = quickSearch(nodes, 'node', 3);

      expect(results).toHaveLength(3);
    });
  });

  describe('quickSearchFlowNodes', () => {
    it('should search FlowNodes', () => {
      const graphNodes = [
        createMockNode({ name: 'findme' }),
        createMockNode({ name: 'other' }),
      ];
      const flowNodes = createMockFlowNodes(graphNodes);

      const results = quickSearchFlowNodes(flowNodes, 'findme');

      expect(results).toHaveLength(1);
      expect(results[0].data.name).toBe('findme');
    });
  });

  describe('isValidSearchQuery', () => {
    it('should return false for empty/null queries', () => {
      expect(isValidSearchQuery('')).toBe(false);
      expect(isValidSearchQuery('  ')).toBe(false);
    });

    it('should return false for queries shorter than minLength', () => {
      expect(isValidSearchQuery('a')).toBe(false);
      expect(isValidSearchQuery('a', 2)).toBe(false);
    });

    it('should return true for valid queries', () => {
      expect(isValidSearchQuery('ab')).toBe(true);
      expect(isValidSearchQuery('test')).toBe(true);
    });

    it('should use custom minLength', () => {
      expect(isValidSearchQuery('abc', 4)).toBe(false);
      expect(isValidSearchQuery('abcd', 4)).toBe(true);
    });
  });

  describe('normalizeQuery', () => {
    it('should trim whitespace', () => {
      expect(normalizeQuery('  test  ')).toBe('test');
    });

    it('should convert to lowercase', () => {
      expect(normalizeQuery('TeSt')).toBe('test');
    });

    it('should handle empty string', () => {
      expect(normalizeQuery('')).toBe('');
    });
  });

  describe('getBestMatchField', () => {
    it('should return null when no matches', () => {
      const result = {
        node: createMockNode(),
        score: 0.5,
        matches: [],
      };

      expect(getBestMatchField(result)).toBeNull();
    });

    it('should return field with most matched characters', () => {
      const result = {
        node: createMockNode(),
        score: 0.1,
        matches: [
          { key: 'name', value: 'test', indices: [[0, 1]] as unknown as readonly [number, number][] }, // 2 chars
          { key: 'id', value: 'testing', indices: [[0, 4]] as unknown as readonly [number, number][] }, // 5 chars
        ],
      };

      expect(getBestMatchField(result)).toBe('id');
    });

    it('should handle single match', () => {
      const result = {
        node: createMockNode(),
        score: 0.1,
        matches: [
          { key: 'name', value: 'test', indices: [[0, 3]] as unknown as readonly [number, number][] },
        ],
      };

      expect(getBestMatchField(result)).toBe('name');
    });
  });
});
