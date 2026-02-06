/**
 * Node Matcher for Graph Diff Computation
 * @module diff/node-matcher
 *
 * Implements efficient O(n) node matching and comparison across graph scans.
 * Uses stable identity keys (type:name:filePath) to match nodes across different
 * scan instances, enabling accurate diff computation.
 *
 * TASK-ROLLUP-005: Diff Computation - Node Matching Component
 *
 * @example
 * ```typescript
 * const matcher = createNodeMatcher();
 * const baseIndex = matcher.indexNodes(baseNodes);
 * const compareIndex = matcher.indexNodes(compareNodes);
 *
 * const added = matcher.findAdded(baseIndex, compareIndex);
 * const removed = matcher.findRemoved(baseIndex, compareIndex);
 * const modified = matcher.findModified(baseIndex, compareIndex);
 * ```
 */

import type { NodeType, NodeLocation } from '../types/graph.js';
import {
  NodeIdentity,
  NodeModification,
  FieldChange,
  createNodeIdentityKey,
  extractNodeIdentity,
  createNodeModification,
  DEFAULT_DIFF_OPTIONS,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Fields to ignore during node comparison.
 * These fields are transient and change between scans without representing
 * actual changes to the node's definition.
 */
export const TRANSIENT_FIELDS: readonly string[] = [
  'id',           // UUID changes between scans
  'createdAt',    // Timestamp changes
  'updatedAt',    // Timestamp changes
  'scanId',       // Always different between scans
] as const;

/**
 * Identity fields that define a node's stable identity.
 * Changes to these fields indicate a different node entirely.
 */
export const IDENTITY_FIELDS: readonly string[] = [
  'type',
  'name',
  'location.file',
] as const;

/**
 * Fields to compare for detecting modifications.
 * Ordered by importance for change detection.
 */
export const COMPARABLE_FIELDS: readonly string[] = [
  // Position changes
  'location.lineStart',
  'location.lineEnd',
  'location.columnStart',
  'location.columnEnd',
  // Common metadata
  'metadata',
  // Type-specific fields are handled dynamically
] as const;

// ============================================================================
// Interface Definition
// ============================================================================

/**
 * Interface for node matching operations in graph diff computation.
 * Provides methods for indexing nodes, extracting identities, and
 * finding added/removed/modified nodes between scans.
 */
export interface INodeMatcher {
  /**
   * Build an index of nodes by their stable identity key.
   * Enables O(1) lookup for node matching operations.
   *
   * @param nodes - Array of nodes to index
   * @returns Map from identity key to node
   *
   * @example
   * ```typescript
   * const index = matcher.indexNodes(scanNodes);
   * const node = index.get('terraform_resource:my-bucket:main.tf');
   * ```
   */
  indexNodes(nodes: readonly NodeType[]): Map<string, NodeType>;

  /**
   * Extract the stable identity from a node.
   * Identity consists of type, name, and file path.
   *
   * @param node - Node to extract identity from
   * @returns NodeIdentity object
   *
   * @example
   * ```typescript
   * const identity = matcher.extractIdentity(node);
   * // { type: 'terraform_resource', name: 'my-bucket', filePath: 'main.tf' }
   * ```
   */
  extractIdentity(node: NodeType): NodeIdentity;

  /**
   * Generate a stable identity key from a NodeIdentity.
   * Format: type:name:filePath
   *
   * @param identity - Node identity object
   * @returns Identity key string
   *
   * @example
   * ```typescript
   * const key = matcher.identityKey(identity);
   * // 'terraform_resource:my-bucket:main.tf'
   * ```
   */
  identityKey(identity: NodeIdentity): string;

  /**
   * Find nodes that exist in the compare scan but not in the base scan.
   * These are newly added nodes.
   *
   * @param baseIndex - Index of base scan nodes
   * @param compareIndex - Index of compare scan nodes
   * @returns Array of added nodes
   *
   * @example
   * ```typescript
   * const added = matcher.findAdded(baseIndex, compareIndex);
   * console.log(`${added.length} nodes were added`);
   * ```
   */
  findAdded(
    baseIndex: Map<string, NodeType>,
    compareIndex: Map<string, NodeType>
  ): NodeType[];

  /**
   * Find nodes that exist in the base scan but not in the compare scan.
   * These are removed nodes.
   *
   * @param baseIndex - Index of base scan nodes
   * @param compareIndex - Index of compare scan nodes
   * @returns Array of removed nodes
   *
   * @example
   * ```typescript
   * const removed = matcher.findRemoved(baseIndex, compareIndex);
   * console.log(`${removed.length} nodes were removed`);
   * ```
   */
  findRemoved(
    baseIndex: Map<string, NodeType>,
    compareIndex: Map<string, NodeType>
  ): NodeType[];

  /**
   * Find nodes that exist in both scans but have field-level changes.
   * Returns detailed modification records with before/after states.
   *
   * @param baseIndex - Index of base scan nodes
   * @param compareIndex - Index of compare scan nodes
   * @returns Array of node modifications
   *
   * @example
   * ```typescript
   * const modified = matcher.findModified(baseIndex, compareIndex);
   * modified.forEach(mod => {
   *   console.log(`Node ${mod.nodeId} changed fields: ${mod.changedFields.join(', ')}`);
   * });
   * ```
   */
  findModified(
    baseIndex: Map<string, NodeType>,
    compareIndex: Map<string, NodeType>
  ): NodeModification[];

  /**
   * Compare two nodes and identify which fields have changed.
   * Ignores transient fields (id, timestamps, scanId).
   *
   * @param before - Node state in base scan
   * @param after - Node state in compare scan
   * @returns Array of changed field names
   *
   * @example
   * ```typescript
   * const changedFields = matcher.compareNodes(baseNode, compareNode);
   * if (changedFields.includes('location.lineStart')) {
   *   console.log('Node position changed');
   * }
   * ```
   */
  compareNodes(before: NodeType, after: NodeType): string[];

  /**
   * Get detailed field-level changes between two nodes.
   * Returns old and new values for each changed field.
   *
   * @param before - Node state in base scan
   * @param after - Node state in compare scan
   * @returns Array of field changes with details
   */
  getFieldChanges(before: NodeType, after: NodeType): FieldChange[];
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * NodeMatcher implementation for graph diff computation.
 * Provides efficient O(n) node matching using stable identity keys.
 */
export class NodeMatcher implements INodeMatcher {
  private readonly ignoreFields: Set<string>;

  /**
   * Create a new NodeMatcher instance.
   *
   * @param options - Configuration options
   * @param options.ignoreFields - Additional fields to ignore during comparison
   */
  constructor(options?: { ignoreFields?: readonly string[] }) {
    const additionalIgnore = options?.ignoreFields ?? DEFAULT_DIFF_OPTIONS.ignoreFields;
    this.ignoreFields = new Set([
      ...TRANSIENT_FIELDS,
      ...additionalIgnore,
    ]);
  }

  /**
   * Build an index of nodes by their stable identity key.
   * Time complexity: O(n) where n is the number of nodes.
   */
  indexNodes(nodes: readonly NodeType[]): Map<string, NodeType> {
    const index = new Map<string, NodeType>();

    for (const node of nodes) {
      const identity = this.extractIdentity(node);
      const key = this.identityKey(identity);
      index.set(key, node);
    }

    return index;
  }

  /**
   * Extract stable identity from a node.
   */
  extractIdentity(node: NodeType): NodeIdentity {
    return extractNodeIdentity(node);
  }

  /**
   * Generate identity key from identity object.
   */
  identityKey(identity: NodeIdentity): string {
    return createNodeIdentityKey(identity);
  }

  /**
   * Find added nodes (in compare but not in base).
   * Time complexity: O(n) where n is the size of compareIndex.
   */
  findAdded(
    baseIndex: Map<string, NodeType>,
    compareIndex: Map<string, NodeType>
  ): NodeType[] {
    const added: NodeType[] = [];

    for (const [key, node] of compareIndex) {
      if (!baseIndex.has(key)) {
        added.push(node);
      }
    }

    return added;
  }

  /**
   * Find removed nodes (in base but not in compare).
   * Time complexity: O(n) where n is the size of baseIndex.
   */
  findRemoved(
    baseIndex: Map<string, NodeType>,
    compareIndex: Map<string, NodeType>
  ): NodeType[] {
    const removed: NodeType[] = [];

    for (const [key, node] of baseIndex) {
      if (!compareIndex.has(key)) {
        removed.push(node);
      }
    }

    return removed;
  }

  /**
   * Find modified nodes with field-level changes.
   * Time complexity: O(n * m) where n is shared nodes, m is fields per node.
   */
  findModified(
    baseIndex: Map<string, NodeType>,
    compareIndex: Map<string, NodeType>
  ): NodeModification[] {
    const modifications: NodeModification[] = [];

    for (const [key, baseNode] of baseIndex) {
      const compareNode = compareIndex.get(key);

      if (compareNode) {
        const changedFields = this.compareNodes(baseNode, compareNode);

        if (changedFields.length > 0) {
          const fieldChanges = this.getFieldChanges(baseNode, compareNode);

          const modification: NodeModification = {
            ...createNodeModification(key, baseNode, compareNode, changedFields),
            fieldChanges,
          };

          modifications.push(modification);
        }
      }
    }

    return modifications;
  }

  /**
   * Compare two nodes and return list of changed field names.
   * Performs deep comparison while ignoring transient fields.
   */
  compareNodes(before: NodeType, after: NodeType): string[] {
    const changedFields: string[] = [];

    // Get all keys from both objects
    const allKeys = new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]);

    for (const key of allKeys) {
      // Skip ignored fields
      if (this.ignoreFields.has(key)) {
        continue;
      }

      const beforeValue = (before as unknown as Record<string, unknown>)[key];
      const afterValue = (after as unknown as Record<string, unknown>)[key];

      // Handle nested location object
      if (key === 'location') {
        const locationChanges = this.compareLocation(
          beforeValue as NodeLocation | undefined,
          afterValue as NodeLocation | undefined
        );
        changedFields.push(...locationChanges);
        continue;
      }

      // Handle nested metadata object
      if (key === 'metadata') {
        if (!this.deepEquals(beforeValue, afterValue)) {
          changedFields.push('metadata');
        }
        continue;
      }

      // Compare other fields
      if (!this.deepEquals(beforeValue, afterValue)) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  /**
   * Get detailed field changes with old and new values.
   */
  getFieldChanges(before: NodeType, after: NodeType): FieldChange[] {
    const changes: FieldChange[] = [];
    const changedFields = this.compareNodes(before, after);

    for (const field of changedFields) {
      const oldValue = this.getNestedValue(before, field);
      const newValue = this.getNestedValue(after, field);

      const changeType = this.determineChangeType(oldValue, newValue);

      changes.push({
        field,
        oldValue,
        newValue,
        changeType,
      });
    }

    return changes;
  }

  /**
   * Compare location objects and return changed location fields.
   */
  private compareLocation(
    before: NodeLocation | undefined,
    after: NodeLocation | undefined
  ): string[] {
    const changes: string[] = [];

    if (!before && !after) {
      return changes;
    }

    if (!before || !after) {
      changes.push('location');
      return changes;
    }

    // Compare individual location fields
    if (before.file !== after.file) {
      changes.push('location.file');
    }
    if (before.lineStart !== after.lineStart) {
      changes.push('location.lineStart');
    }
    if (before.lineEnd !== after.lineEnd) {
      changes.push('location.lineEnd');
    }
    if (before.columnStart !== after.columnStart) {
      changes.push('location.columnStart');
    }
    if (before.columnEnd !== after.columnEnd) {
      changes.push('location.columnEnd');
    }

    return changes;
  }

  /**
   * Get a nested value from an object using dot notation.
   */
  private getNestedValue(obj: NodeType, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Determine the type of change between two values.
   */
  private determineChangeType(
    oldValue: unknown,
    newValue: unknown
  ): FieldChange['changeType'] {
    if (oldValue === undefined && newValue !== undefined) {
      return 'added';
    }
    if (oldValue !== undefined && newValue === undefined) {
      return 'removed';
    }
    if (typeof oldValue !== typeof newValue) {
      return 'type_changed';
    }
    return 'value_changed';
  }

  /**
   * Deep equality check for any two values.
   * Handles primitives, arrays, objects, and nested structures.
   */
  private deepEquals(a: unknown, b: unknown): boolean {
    // Strict equality for primitives
    if (a === b) {
      return true;
    }

    // Handle null/undefined
    if (a === null || b === null || a === undefined || b === undefined) {
      return false;
    }

    // Type mismatch
    if (typeof a !== typeof b) {
      return false;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      return this.arraysEqual(a, b);
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      return this.objectsEqual(
        a as Record<string, unknown>,
        b as Record<string, unknown>
      );
    }

    // Handle other types (number, string, boolean)
    return a === b;
  }

  /**
   * Deep equality check for arrays.
   */
  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!this.deepEquals(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deep equality check for objects.
   */
  private objectsEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>
  ): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // Filter out ignored fields
    const filteredKeysA = keysA.filter(k => !this.ignoreFields.has(k));
    const filteredKeysB = keysB.filter(k => !this.ignoreFields.has(k));

    if (filteredKeysA.length !== filteredKeysB.length) {
      return false;
    }

    for (const key of filteredKeysA) {
      if (!this.deepEquals(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Options for creating a NodeMatcher instance.
 */
export interface NodeMatcherOptions {
  /**
   * Additional fields to ignore during node comparison.
   * These are added to the default transient fields (id, createdAt, updatedAt, scanId).
   */
  ignoreFields?: readonly string[];
}

/**
 * Create a new NodeMatcher instance.
 *
 * @param options - Configuration options
 * @returns Configured NodeMatcher instance
 *
 * @example
 * ```typescript
 * // Default configuration
 * const matcher = createNodeMatcher();
 *
 * // With custom ignore fields
 * const matcher = createNodeMatcher({
 *   ignoreFields: ['customField', 'temporaryData'],
 * });
 * ```
 */
export function createNodeMatcher(options?: NodeMatcherOptions): INodeMatcher {
  return new NodeMatcher(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute the stable identity key for a node.
 * Convenience function that extracts identity and generates key in one step.
 *
 * @param node - Node to compute key for
 * @returns Stable identity key string
 *
 * @example
 * ```typescript
 * const key = nodeKey(myNode);
 * // 'terraform_resource:my-bucket:main.tf'
 * ```
 */
export function nodeKey(node: NodeType): string {
  return `${node.type}:${node.name}:${node.location.file}`;
}

/**
 * Parse a node identity key back into its components.
 *
 * @param key - Identity key to parse
 * @returns NodeIdentity object or null if invalid format
 *
 * @example
 * ```typescript
 * const identity = parseNodeKey('terraform_resource:my-bucket:main.tf');
 * // { type: 'terraform_resource', name: 'my-bucket', filePath: 'main.tf' }
 * ```
 */
export function parseNodeKey(key: string): NodeIdentity | null {
  const parts = key.split(':');

  // Need at least 3 parts (type, name, filePath)
  // filePath may contain colons, so join remaining parts
  if (parts.length < 3) {
    return null;
  }

  const type = parts[0];
  const name = parts[1];
  const filePath = parts.slice(2).join(':');

  if (!type || !name || !filePath) {
    return null;
  }

  return { type, name, filePath };
}

/**
 * Check if two nodes have the same identity.
 *
 * @param a - First node
 * @param b - Second node
 * @returns True if nodes have the same identity
 *
 * @example
 * ```typescript
 * if (sameIdentity(baseNode, compareNode)) {
 *   console.log('Nodes represent the same entity');
 * }
 * ```
 */
export function sameIdentity(a: NodeType, b: NodeType): boolean {
  return (
    a.type === b.type &&
    a.name === b.name &&
    a.location.file === b.location.file
  );
}

/**
 * Group nodes by their type.
 *
 * @param nodes - Nodes to group
 * @returns Map from node type to array of nodes
 *
 * @example
 * ```typescript
 * const grouped = groupNodesByType(nodes);
 * const terraformResources = grouped.get('terraform_resource') ?? [];
 * ```
 */
export function groupNodesByType(
  nodes: readonly NodeType[]
): Map<string, NodeType[]> {
  const groups = new Map<string, NodeType[]>();

  for (const node of nodes) {
    const existing = groups.get(node.type);
    if (existing) {
      existing.push(node);
    } else {
      groups.set(node.type, [node]);
    }
  }

  return groups;
}

/**
 * Group nodes by their file path.
 *
 * @param nodes - Nodes to group
 * @returns Map from file path to array of nodes
 *
 * @example
 * ```typescript
 * const grouped = groupNodesByFile(nodes);
 * const mainTfNodes = grouped.get('main.tf') ?? [];
 * ```
 */
export function groupNodesByFile(
  nodes: readonly NodeType[]
): Map<string, NodeType[]> {
  const groups = new Map<string, NodeType[]>();

  for (const node of nodes) {
    const filePath = node.location.file;
    const existing = groups.get(filePath);
    if (existing) {
      existing.push(node);
    } else {
      groups.set(filePath, [node]);
    }
  }

  return groups;
}

// ============================================================================
// Exports
// ============================================================================

export type { NodeIdentity, NodeModification, FieldChange };
