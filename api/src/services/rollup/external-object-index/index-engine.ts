/**
 * Index Engine
 * @module services/rollup/external-object-index/index-engine
 *
 * Core engine for building the external object inverted index.
 * Processes nodes to extract external references and build lookup structures.
 *
 * TASK-ROLLUP-003: External Object Index building engine
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import { randomUUID } from 'crypto';
import pino from 'pino';
import { NodeType } from '../../../types/graph.js';
import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import type {
  IIndexEngine,
  IExtractorFactory,
  ExternalObjectEntry,
  ExternalReferenceType,
} from './interfaces.js';
import { getDefaultExtractorFactory } from './extractors/index.js';
import { IndexBuildError } from './errors.js';

const logger = pino({ name: 'index-engine' });

/**
 * Processing context for node extraction
 */
interface ProcessingContext {
  readonly tenantId: TenantId;
  readonly repositoryId: RepositoryId;
  readonly scanId: ScanId;
}

/**
 * Index engine for building external object index.
 * Optimized for high throughput with batch processing.
 */
export class IndexEngine implements IIndexEngine {
  private readonly extractorFactory: IExtractorFactory;

  /**
   * Create a new IndexEngine
   * @param extractorFactory - Factory for creating extractors
   */
  constructor(extractorFactory?: IExtractorFactory) {
    this.extractorFactory = extractorFactory ?? getDefaultExtractorFactory();
  }

  /**
   * Process nodes and extract external references
   * Optimized for high throughput with batch processing
   */
  processNodes(
    nodes: NodeType[],
    context: ProcessingContext
  ): ExternalObjectEntry[] {
    const startTime = Date.now();
    const entries: ExternalObjectEntry[] = [];
    const errors: string[] = [];

    logger.info(
      { nodeCount: nodes.length, tenantId: context.tenantId, repositoryId: context.repositoryId },
      'Starting node processing'
    );

    for (const node of nodes) {
      try {
        const nodeEntries = this.processNode(node, context);
        entries.push(...nodeEntries);
      } catch (error) {
        logger.warn(
          { error, nodeId: node.id, nodeType: node.type },
          'Failed to process node'
        );
        errors.push(node.id);
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const throughput = (nodes.length / processingTimeMs) * 1000;

    logger.info(
      {
        nodeCount: nodes.length,
        entryCount: entries.length,
        errorCount: errors.length,
        processingTimeMs,
        throughputNodesPerSec: Math.round(throughput),
      },
      'Node processing completed'
    );

    // Check error threshold
    if (errors.length > 0 && errors.length / nodes.length > 0.1) {
      throw IndexBuildError.fromPartialResult(
        entries.length,
        errors.length,
        errors
      );
    }

    return entries;
  }

  /**
   * Build inverted index from entries
   * Creates a map of externalId -> entries for O(1) lookup
   */
  buildInvertedIndex(
    entries: ExternalObjectEntry[]
  ): Map<string, ExternalObjectEntry[]> {
    const startTime = Date.now();
    const index = new Map<string, ExternalObjectEntry[]>();

    for (const entry of entries) {
      // Index by external ID
      const key = entry.externalId.toLowerCase();
      const existing = index.get(key) ?? [];
      existing.push(entry);
      index.set(key, existing);

      // Also index by normalized ID if different
      if (entry.normalizedId !== key) {
        const normalizedExisting = index.get(entry.normalizedId) ?? [];
        normalizedExisting.push(entry);
        index.set(entry.normalizedId, normalizedExisting);
      }
    }

    logger.debug(
      {
        entryCount: entries.length,
        uniqueKeys: index.size,
        timeMs: Date.now() - startTime,
      },
      'Inverted index built'
    );

    return index;
  }

  /**
   * Merge new entries into existing index
   * Handles deduplication and updates
   */
  mergeIndex(
    existing: Map<string, ExternalObjectEntry[]>,
    newEntries: ExternalObjectEntry[]
  ): Map<string, ExternalObjectEntry[]> {
    const startTime = Date.now();
    const merged = new Map(existing);

    for (const entry of newEntries) {
      const key = entry.externalId.toLowerCase();
      const existingEntries = merged.get(key) ?? [];

      // Check for duplicate (same external ID and node)
      const duplicateIndex = existingEntries.findIndex(
        (e) => e.nodeId === entry.nodeId && e.scanId === entry.scanId
      );

      if (duplicateIndex >= 0) {
        // Update existing entry
        existingEntries[duplicateIndex] = entry;
      } else {
        // Add new entry
        existingEntries.push(entry);
      }

      merged.set(key, existingEntries);

      // Also merge normalized ID
      if (entry.normalizedId !== key) {
        const normalizedEntries = merged.get(entry.normalizedId) ?? [];
        const normalizedDupIndex = normalizedEntries.findIndex(
          (e) => e.nodeId === entry.nodeId && e.scanId === entry.scanId
        );

        if (normalizedDupIndex >= 0) {
          normalizedEntries[normalizedDupIndex] = entry;
        } else {
          normalizedEntries.push(entry);
        }

        merged.set(entry.normalizedId, normalizedEntries);
      }
    }

    logger.debug(
      {
        existingKeys: existing.size,
        newEntries: newEntries.length,
        mergedKeys: merged.size,
        timeMs: Date.now() - startTime,
      },
      'Index merged'
    );

    return merged;
  }

  /**
   * Build index with reverse lookup support
   * Creates additional indexes for node-to-reference lookup
   */
  buildWithReverseLookup(
    entries: ExternalObjectEntry[]
  ): {
    forward: Map<string, ExternalObjectEntry[]>;
    reverse: Map<string, ExternalObjectEntry[]>;
  } {
    const forward = this.buildInvertedIndex(entries);
    const reverse = new Map<string, ExternalObjectEntry[]>();

    // Build reverse index: nodeId -> entries
    for (const entry of entries) {
      const nodeKey = `${entry.scanId}:${entry.nodeId}`;
      const existing = reverse.get(nodeKey) ?? [];
      existing.push(entry);
      reverse.set(nodeKey, existing);
    }

    return { forward, reverse };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Process a single node and extract references
   */
  private processNode(
    node: NodeType,
    context: ProcessingContext
  ): ExternalObjectEntry[] {
    const entries: ExternalObjectEntry[] = [];
    const extractors = this.extractorFactory.getExtractorsForNode(node);

    for (const extractor of extractors) {
      try {
        const references = extractor.extract(node);

        for (const ref of references) {
          const entry: ExternalObjectEntry = {
            id: randomUUID(),
            externalId: ref.externalId,
            referenceType: ref.referenceType,
            normalizedId: ref.normalizedId,
            tenantId: context.tenantId,
            repositoryId: context.repositoryId,
            scanId: context.scanId,
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            filePath: node.location.file,
            components: ref.components,
            metadata: {
              ...ref.metadata,
              sourceAttribute: ref.sourceAttribute,
              lineStart: node.location.lineStart,
              lineEnd: node.location.lineEnd,
            },
            indexedAt: new Date(),
          };

          entries.push(entry);
        }
      } catch (error) {
        logger.warn(
          {
            error,
            nodeId: node.id,
            extractor: extractor.referenceType,
          },
          'Extractor failed for node'
        );
        // Continue with other extractors
      }
    }

    return entries;
  }
}

/**
 * Create a new IndexEngine instance
 */
export function createIndexEngine(
  extractorFactory?: IExtractorFactory
): IndexEngine {
  return new IndexEngine(extractorFactory);
}

// ============================================================================
// Singleton Management
// ============================================================================

let defaultEngine: IndexEngine | null = null;

/**
 * Get the default IndexEngine instance
 */
export function getDefaultIndexEngine(): IndexEngine {
  if (!defaultEngine) {
    defaultEngine = new IndexEngine();
  }
  return defaultEngine;
}

/**
 * Reset the default engine instance
 */
export function resetDefaultIndexEngine(): void {
  defaultEngine = null;
}
