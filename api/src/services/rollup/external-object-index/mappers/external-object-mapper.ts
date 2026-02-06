/**
 * External Object Data Mapper
 * @module services/rollup/external-object-index/mappers/external-object-mapper
 *
 * Maps between domain objects and persistence representations.
 * Isolates domain logic from database-specific concerns.
 *
 * TASK-ROLLUP-003: Data layer mapper implementation
 */

import { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';
import type {
  ExternalObjectEntry,
  ExternalReferenceType,
} from '../interfaces.js';
import {
  computeReferenceHash,
  type ReferenceHash,
  type ExternalRefType,
  type IndexEntryDTO,
} from '../domain/types.js';
import type {
  IndexEntry,
  IndexEntryCreate,
  NodeReference,
  ExternalObjectId,
} from '../external-object-repository.js';

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Raw database row from external_object_index table
 */
export interface ExternalObjectIndexRow {
  readonly id: string;
  readonly external_id: string;
  readonly reference_type: string;
  readonly normalized_id: string;
  readonly tenant_id: string;
  readonly repository_id: string;
  readonly scan_id: string;
  readonly node_id: string;
  readonly node_name: string;
  readonly node_type: string;
  readonly file_path: string;
  readonly components: string | Record<string, string>;
  readonly metadata: string | Record<string, unknown>;
  readonly indexed_at: string | Date;
}

/**
 * Raw database row from node_external_objects junction table
 */
export interface NodeExternalObjectRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly node_id: string;
  readonly external_object_id: string;
  readonly scan_id: string;
  readonly repository_id: string;
  readonly reference_hash: string;
  readonly ref_type: string;
  readonly confidence: string | number;
  readonly context: string | Record<string, unknown>;
  readonly created_at: string | Date;
}

/**
 * Raw database row from external_objects_master table
 */
export interface ExternalObjectMasterRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly external_id: string;
  readonly ref_type: string;
  readonly provider: string | null;
  readonly normalized_id: string;
  readonly reference_hash: string;
  readonly components: string | Record<string, string>;
  readonly first_seen_at: string | Date;
  readonly last_seen_at: string | Date;
  readonly reference_count: number;
}

// ============================================================================
// Persistence Data Types
// ============================================================================

/**
 * Data to persist to external_object_index table
 */
export interface ExternalObjectIndexPersistence {
  readonly id: string;
  readonly external_id: string;
  readonly reference_type: ExternalReferenceType;
  readonly normalized_id: string;
  readonly tenant_id: string;
  readonly repository_id: string;
  readonly scan_id: string;
  readonly node_id: string;
  readonly node_name: string;
  readonly node_type: string;
  readonly file_path: string;
  readonly components: string;
  readonly metadata: string;
  readonly indexed_at: Date;
}

/**
 * Data to persist to node_external_objects junction table
 */
export interface NodeExternalObjectPersistence {
  readonly tenant_id: string;
  readonly node_id: string;
  readonly external_object_id: string;
  readonly scan_id: string;
  readonly repository_id: string;
  readonly reference_hash: string;
  readonly ref_type: string;
  readonly confidence: number;
  readonly context: string;
}

// ============================================================================
// Mapper Implementation
// ============================================================================

/**
 * External Object Data Mapper
 *
 * Provides bidirectional mapping between domain objects and database rows.
 * All JSON serialization/deserialization is handled here.
 */
export class ExternalObjectMapper {
  // ============================================================================
  // Domain to Persistence
  // ============================================================================

  /**
   * Convert ExternalObjectEntry (domain) to persistence format
   */
  entryToPersistence(entry: ExternalObjectEntry): ExternalObjectIndexPersistence {
    return {
      id: entry.id,
      external_id: entry.externalId,
      reference_type: entry.referenceType,
      normalized_id: entry.normalizedId,
      tenant_id: entry.tenantId,
      repository_id: entry.repositoryId,
      scan_id: entry.scanId,
      node_id: entry.nodeId,
      node_name: entry.nodeName,
      node_type: entry.nodeType,
      file_path: entry.filePath,
      components: JSON.stringify(entry.components),
      metadata: JSON.stringify(entry.metadata),
      indexed_at: entry.indexedAt,
    };
  }

  /**
   * Convert IndexEntryCreate (domain) to junction table persistence format
   */
  indexEntryToPersistence(entry: IndexEntryCreate): NodeExternalObjectPersistence {
    return {
      tenant_id: entry.tenantId,
      node_id: entry.nodeId,
      external_object_id: entry.externalObjectId,
      scan_id: entry.scanId,
      repository_id: entry.repositoryId,
      reference_hash: entry.referenceHash,
      ref_type: entry.refType,
      confidence: entry.confidence ?? 1.0,
      context: JSON.stringify(entry.context ?? {}),
    };
  }

  /**
   * Convert multiple entries to persistence format
   */
  entriesToPersistence(entries: ExternalObjectEntry[]): ExternalObjectIndexPersistence[] {
    return entries.map((entry) => this.entryToPersistence(entry));
  }

  // ============================================================================
  // Persistence to Domain
  // ============================================================================

  /**
   * Convert database row to ExternalObjectEntry (domain)
   */
  rowToEntry(row: ExternalObjectIndexRow): ExternalObjectEntry {
    return {
      id: row.id,
      externalId: row.external_id,
      referenceType: row.reference_type as ExternalReferenceType,
      normalizedId: row.normalized_id,
      tenantId: row.tenant_id as TenantId,
      repositoryId: row.repository_id as RepositoryId,
      scanId: row.scan_id as ScanId,
      nodeId: row.node_id,
      nodeName: row.node_name,
      nodeType: row.node_type,
      filePath: row.file_path,
      components: this.parseJson<Record<string, string>>(row.components, {}),
      metadata: this.parseJson<Record<string, unknown>>(row.metadata, {}),
      indexedAt: this.parseDate(row.indexed_at),
    };
  }

  /**
   * Convert junction table row to IndexEntry (domain)
   */
  junctionRowToIndexEntry(row: NodeExternalObjectRow): IndexEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id as TenantId,
      nodeId: row.node_id,
      externalObjectId: row.external_object_id as ExternalObjectId,
      scanId: row.scan_id as ScanId,
      repositoryId: row.repository_id as RepositoryId,
      referenceHash: row.reference_hash as ReferenceHash,
      refType: row.ref_type as ExternalRefType,
      confidence: this.parseNumber(row.confidence, 1.0),
      context: this.parseJson<Record<string, unknown>>(row.context, {}),
      createdAt: this.parseDate(row.created_at),
    };
  }

  /**
   * Convert junction table row to NodeReference
   */
  rowToNodeReference(row: NodeExternalObjectRow & { total_count?: string }): NodeReference {
    return {
      nodeId: row.node_id,
      repositoryId: row.repository_id as RepositoryId,
      scanId: row.scan_id as ScanId,
      refType: row.ref_type as ExternalReferenceType,
      confidence: this.parseNumber(row.confidence, 1.0),
      context: this.parseJson<Record<string, unknown>>(row.context, {}),
      createdAt: this.parseDate(row.created_at),
    };
  }

  /**
   * Convert multiple rows to domain entries
   */
  rowsToEntries(rows: ExternalObjectIndexRow[]): ExternalObjectEntry[] {
    return rows.map((row) => this.rowToEntry(row));
  }

  // ============================================================================
  // DTO Conversion
  // ============================================================================

  /**
   * Convert ExternalObjectEntry to DTO for API responses
   */
  entryToDTO(entry: ExternalObjectEntry): IndexEntryDTO {
    return {
      id: entry.id,
      nodeId: entry.nodeId,
      scanId: entry.scanId,
      repositoryId: entry.repositoryId,
      tenantId: entry.tenantId,
      references: [{
        refType: entry.referenceType as ExternalRefType,
        identifier: entry.externalId,
        provider: null,
        attributes: entry.components,
        confidence: 1.0,
        referenceHash: computeReferenceHash(
          entry.referenceType as ExternalRefType,
          entry.externalId
        ),
      }],
      createdAt: entry.indexedAt.toISOString(),
      updatedAt: entry.indexedAt.toISOString(),
    };
  }

  /**
   * Convert IndexEntry to DTO
   */
  indexEntryToDTO(entry: IndexEntry): Partial<IndexEntryDTO> {
    return {
      id: entry.id,
      nodeId: entry.nodeId,
      scanId: entry.scanId,
      repositoryId: entry.repositoryId,
      tenantId: entry.tenantId,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.createdAt.toISOString(),
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Compute reference hash for an entry
   */
  computeHash(refType: ExternalRefType, identifier: string): ReferenceHash {
    return computeReferenceHash(refType, identifier);
  }

  /**
   * Normalize an external ID for consistent matching
   */
  normalizeExternalId(externalId: string): string {
    return externalId.toLowerCase().trim();
  }

  /**
   * Create IndexEntryCreate from domain data
   */
  createIndexEntry(params: {
    tenantId: TenantId;
    nodeId: string;
    externalObjectId: string;
    scanId: ScanId;
    repositoryId: RepositoryId;
    refType: ExternalRefType;
    identifier: string;
    confidence?: number;
    context?: Record<string, unknown>;
  }): IndexEntryCreate {
    return {
      tenantId: params.tenantId,
      nodeId: params.nodeId,
      externalObjectId: params.externalObjectId as ExternalObjectId,
      scanId: params.scanId,
      repositoryId: params.repositoryId,
      referenceHash: this.computeHash(params.refType, params.identifier),
      refType: params.refType,
      confidence: params.confidence ?? 1.0,
      context: params.context ?? {},
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Parse JSON safely with fallback
   */
  private parseJson<T>(value: string | T, fallback: T): T {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return value;
  }

  /**
   * Parse date value
   */
  private parseDate(value: string | Date): Date {
    if (value instanceof Date) {
      return value;
    }
    return new Date(value);
  }

  /**
   * Parse number value
   */
  private parseNumber(value: string | number, fallback: number): number {
    if (typeof value === 'number') {
      return value;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultMapper: ExternalObjectMapper | null = null;

/**
 * Get the default mapper instance
 */
export function getDefaultMapper(): ExternalObjectMapper {
  if (!defaultMapper) {
    defaultMapper = new ExternalObjectMapper();
  }
  return defaultMapper;
}

/**
 * Create a new mapper instance
 */
export function createExternalObjectMapper(): ExternalObjectMapper {
  return new ExternalObjectMapper();
}

/**
 * Reset the default mapper (for testing)
 */
export function resetDefaultMapper(): void {
  defaultMapper = null;
}
