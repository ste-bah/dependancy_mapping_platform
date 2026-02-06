/**
 * Extractor Factory
 * @module services/rollup/external-object-index/extractors/extractor-factory
 *
 * Factory for creating and managing external reference extractors.
 * Implements the Factory pattern for extractor instantiation.
 *
 * TASK-ROLLUP-003: External Object Index extractor factory
 */

import { NodeType } from '../../../../types/graph.js';
import type {
  IExtractorFactory,
  IExternalReferenceExtractor,
  ExternalReferenceType,
} from '../interfaces.js';
import { ArnExtractor, createArnExtractor } from './arn-extractor.js';
import { ResourceIdExtractor, createResourceIdExtractor } from './resource-id-extractor.js';
import { K8sExtractor, createK8sExtractor } from './k8s-extractor.js';

/**
 * Factory for creating external reference extractors.
 * Manages extractor registration and provides node-based extractor selection.
 */
export class ExtractorFactory implements IExtractorFactory {
  /**
   * Registry of extractors by type
   */
  private readonly extractors: Map<ExternalReferenceType, IExternalReferenceExtractor> = new Map();

  /**
   * Whether factory has been initialized with default extractors
   */
  private initialized = false;

  /**
   * Create a new ExtractorFactory
   * @param autoInit - Whether to auto-initialize with default extractors
   */
  constructor(autoInit = true) {
    if (autoInit) {
      this.initializeDefaults();
    }
  }

  /**
   * Initialize factory with default extractors
   */
  private initializeDefaults(): void {
    if (this.initialized) {
      return;
    }

    // Register built-in extractors
    this.registerExtractor(createArnExtractor());
    this.registerExtractor(createResourceIdExtractor());
    this.registerExtractor(createK8sExtractor());

    this.initialized = true;
  }

  /**
   * Get extractor for a reference type
   */
  getExtractor(type: ExternalReferenceType): IExternalReferenceExtractor | null {
    return this.extractors.get(type) ?? null;
  }

  /**
   * Get all available extractors
   */
  getAllExtractors(): IExternalReferenceExtractor[] {
    return Array.from(this.extractors.values());
  }

  /**
   * Get extractors that can handle a node
   */
  getExtractorsForNode(node: NodeType): IExternalReferenceExtractor[] {
    return this.getAllExtractors().filter((extractor) => extractor.canHandle(node));
  }

  /**
   * Register a custom extractor
   */
  registerExtractor(extractor: IExternalReferenceExtractor): void {
    this.extractors.set(extractor.referenceType, extractor);
  }

  /**
   * Unregister an extractor
   */
  unregisterExtractor(type: ExternalReferenceType): boolean {
    return this.extractors.delete(type);
  }

  /**
   * Get all registered reference types
   */
  getRegisteredTypes(): ExternalReferenceType[] {
    return Array.from(this.extractors.keys());
  }

  /**
   * Check if an extractor is registered for a type
   */
  hasExtractor(type: ExternalReferenceType): boolean {
    return this.extractors.has(type);
  }

  /**
   * Clear all extractors
   */
  clear(): void {
    this.extractors.clear();
    this.initialized = false;
  }

  /**
   * Reset to default extractors
   */
  reset(): void {
    this.clear();
    this.initializeDefaults();
  }

  /**
   * Extract all references from a node using all applicable extractors
   */
  extractAll(node: NodeType): Array<{
    extractor: ExternalReferenceType;
    references: ReturnType<IExternalReferenceExtractor['extract']>;
  }> {
    const results: Array<{
      extractor: ExternalReferenceType;
      references: ReturnType<IExternalReferenceExtractor['extract']>;
    }> = [];

    for (const extractor of this.getExtractorsForNode(node)) {
      const references = extractor.extract(node);
      if (references.length > 0) {
        results.push({
          extractor: extractor.referenceType,
          references,
        });
      }
    }

    return results;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

/**
 * Default factory instance
 */
let defaultFactory: ExtractorFactory | null = null;

/**
 * Get the default extractor factory instance
 */
export function getDefaultExtractorFactory(): ExtractorFactory {
  if (!defaultFactory) {
    defaultFactory = new ExtractorFactory(true);
  }
  return defaultFactory;
}

/**
 * Reset the default factory instance
 */
export function resetDefaultExtractorFactory(): void {
  if (defaultFactory) {
    defaultFactory.clear();
  }
  defaultFactory = null;
}

/**
 * Create a new ExtractorFactory instance
 */
export function createExtractorFactory(autoInit = true): ExtractorFactory {
  return new ExtractorFactory(autoInit);
}
