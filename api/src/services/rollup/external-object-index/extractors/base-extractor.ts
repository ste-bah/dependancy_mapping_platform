/**
 * Base External Reference Extractor
 * @module services/rollup/external-object-index/extractors/base-extractor
 *
 * Abstract base class for external reference extraction.
 * Provides common functionality for ARN, Resource ID, and K8s extractors.
 *
 * TASK-ROLLUP-003: External Object Index extractors
 */

import { NodeType, isTerraformNode, isK8sNode } from '../../../../types/graph.js';
import type {
  IExternalReferenceExtractor,
  ExternalReferenceType,
  ExtractedReference,
} from '../interfaces.js';

/**
 * Abstract base class for external reference extractors.
 * Provides common functionality for all extractor implementations.
 */
export abstract class BaseExtractor implements IExternalReferenceExtractor {
  /**
   * Reference type this extractor handles
   */
  abstract readonly referenceType: ExternalReferenceType;

  /**
   * Node types this extractor can handle
   */
  protected abstract readonly supportedNodeTypes: string[];

  /**
   * Attributes to search for external references
   */
  protected abstract readonly searchAttributes: string[];

  /**
   * Check if this extractor can handle the node
   */
  canHandle(node: NodeType): boolean {
    return this.supportedNodeTypes.includes(node.type);
  }

  /**
   * Extract external references from a node
   */
  extract(node: NodeType): ExtractedReference[] {
    if (!this.canHandle(node)) {
      return [];
    }

    const references: ExtractedReference[] = [];

    // Search through metadata for external references
    for (const attr of this.searchAttributes) {
      const value = this.getNestedValue(node.metadata, attr);

      if (value !== undefined && value !== null) {
        const extracted = this.extractFromValue(value, attr);
        references.push(...extracted);
      }
    }

    // Also search in node-specific fields
    const additionalRefs = this.extractFromNodeFields(node);
    references.push(...additionalRefs);

    return references;
  }

  /**
   * Normalize an external ID for matching
   */
  abstract normalize(externalId: string): string;

  /**
   * Parse external ID into components
   */
  abstract parseComponents(externalId: string): Record<string, string> | null;

  /**
   * Extract references from a value
   */
  protected abstract extractFromValue(
    value: unknown,
    sourceAttribute: string
  ): ExtractedReference[];

  /**
   * Extract additional references from node-specific fields
   */
  protected extractFromNodeFields(_node: NodeType): ExtractedReference[] {
    // Default implementation returns empty
    // Subclasses can override for node-specific extraction
    return [];
  }

  /**
   * Create an ExtractedReference object
   */
  protected createReference(
    externalId: string,
    sourceAttribute: string,
    metadata: Record<string, unknown> = {}
  ): ExtractedReference {
    const normalizedId = this.normalize(externalId);
    const components = this.parseComponents(externalId);

    return {
      externalId,
      referenceType: this.referenceType,
      normalizedId,
      components: components ?? {},
      sourceAttribute,
      metadata,
    };
  }

  /**
   * Get a nested value from an object using dot notation
   */
  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Check if a string matches an external ID pattern
   */
  protected abstract isValidExternalId(value: string): boolean;

  /**
   * Find all string values in an object recursively
   */
  protected findAllStrings(
    obj: unknown,
    prefix: string = ''
  ): Array<{ path: string; value: string }> {
    const results: Array<{ path: string; value: string }> = [];

    if (typeof obj === 'string') {
      results.push({ path: prefix, value: obj });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        results.push(...this.findAllStrings(item, `${prefix}[${index}]`));
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = prefix ? `${prefix}.${key}` : key;
        results.push(...this.findAllStrings(value, newPath));
      }
    }

    return results;
  }

  /**
   * Check if node is a Terraform node
   */
  protected isTerraformNode(node: NodeType): boolean {
    return isTerraformNode(node);
  }

  /**
   * Check if node is a Kubernetes node
   */
  protected isK8sNode(node: NodeType): boolean {
    return isK8sNode(node);
  }

  /**
   * Sanitize external ID by removing whitespace and control characters
   */
  protected sanitize(value: string): string {
    return value.trim().replace(/[\x00-\x1F\x7F]/g, '');
  }

  /**
   * Generate a deterministic hash for caching
   */
  protected generateHash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
