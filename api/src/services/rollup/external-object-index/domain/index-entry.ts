/**
 * Index Entry Aggregate Root
 * @module services/rollup/external-object-index/domain/index-entry
 *
 * Aggregate root for the External Object Index bounded context.
 * Manages a collection of external references associated with a node.
 *
 * TASK-ROLLUP-003: Domain layer aggregate implementation
 */

import { randomUUID } from 'crypto';
import { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';
import { Result, ValidationError, ValidationResult, DomainError } from './result.js';
import { ExternalReferenceVO } from './external-reference.js';
import {
  ReferenceHash,
  IndexEntryId,
  createIndexEntryId,
  CreateIndexEntryParams,
  IndexEntryDTO,
  computeCollectionHash,
} from './types.js';

// ============================================================================
// Index Entry Aggregate Root
// ============================================================================

/**
 * Aggregate root managing external references for a specific node.
 * Enforces invariants across the reference collection.
 *
 * An aggregate root is the entry point for all modifications to the aggregate.
 * All changes to contained entities (references) must go through this class.
 *
 * @example
 * ```typescript
 * const entry = IndexEntryAggregate.create({
 *   nodeId: 'node-123',
 *   scanId: 'scan-456' as ScanId,
 *   repositoryId: 'repo-789' as RepositoryId,
 *   tenantId: 'tenant-abc' as TenantId,
 * });
 *
 * if (Result.isOk(entry)) {
 *   entry.value.addReference(arnReference);
 * }
 * ```
 */
export class IndexEntryAggregate {
  /**
   * Private constructor - use factory methods
   */
  private constructor(
    /** Unique entry ID */
    public readonly id: IndexEntryId,
    /** Node ID this entry belongs to */
    public readonly nodeId: string,
    /** Scan ID where the node was discovered */
    public readonly scanId: ScanId,
    /** Repository ID containing the node */
    public readonly repositoryId: RepositoryId,
    /** Tenant ID for multi-tenancy */
    public readonly tenantId: TenantId,
    /** Mutable collection of references */
    private _references: ExternalReferenceVO[],
    /** Creation timestamp */
    public readonly createdAt: Date,
    /** Last update timestamp */
    private _updatedAt: Date
  ) {}

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Get the last update timestamp
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Get the number of references
   */
  get referenceCount(): number {
    return this._references.length;
  }

  /**
   * Check if entry has any references
   */
  get hasReferences(): boolean {
    return this._references.length > 0;
  }

  /**
   * Get hash of all references for change detection
   */
  get collectionHash(): ReferenceHash {
    const hashes = this._references.map(r => r.referenceHash);
    return computeCollectionHash(hashes);
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a new IndexEntryAggregate with validation
   *
   * @param params - Creation parameters
   * @returns Result containing the aggregate or validation error
   *
   * @example
   * ```typescript
   * const result = IndexEntryAggregate.create({
   *   nodeId: 'node-123',
   *   scanId: 'scan-456' as ScanId,
   *   repositoryId: 'repo-789' as RepositoryId,
   *   tenantId: 'tenant-abc' as TenantId,
   * });
   * ```
   */
  static create(params: CreateIndexEntryParams): ValidationResult<IndexEntryAggregate> {
    // Validate nodeId
    if (!params.nodeId || typeof params.nodeId !== 'string') {
      return Result.err(ValidationError.required('nodeId'));
    }
    const nodeId = params.nodeId.trim();
    if (nodeId.length === 0) {
      return Result.err(
        ValidationError.invalidValue('nodeId', params.nodeId, 'Node ID cannot be empty')
      );
    }

    // Validate scanId
    if (!params.scanId || typeof params.scanId !== 'string') {
      return Result.err(ValidationError.required('scanId'));
    }

    // Validate repositoryId
    if (!params.repositoryId || typeof params.repositoryId !== 'string') {
      return Result.err(ValidationError.required('repositoryId'));
    }

    // Validate tenantId
    if (!params.tenantId || typeof params.tenantId !== 'string') {
      return Result.err(ValidationError.required('tenantId'));
    }

    // Generate or use provided ID
    const id = createIndexEntryId(params.id ?? randomUUID());
    const now = new Date();

    return Result.ok(
      new IndexEntryAggregate(
        id,
        nodeId,
        params.scanId as ScanId,
        params.repositoryId as RepositoryId,
        params.tenantId as TenantId,
        [],
        now,
        now
      )
    );
  }

  /**
   * Reconstitute from persisted data (no validation)
   * Use when loading from trusted source like database
   *
   * @param data - Persisted entry data
   * @returns IndexEntryAggregate instance
   */
  static reconstitute(data: {
    id: string;
    nodeId: string;
    scanId: string;
    repositoryId: string;
    tenantId: string;
    references: ExternalReferenceVO[];
    createdAt: Date;
    updatedAt: Date;
  }): IndexEntryAggregate {
    return new IndexEntryAggregate(
      createIndexEntryId(data.id),
      data.nodeId,
      data.scanId as ScanId,
      data.repositoryId as RepositoryId,
      data.tenantId as TenantId,
      [...data.references],
      data.createdAt,
      data.updatedAt
    );
  }

  // ==========================================================================
  // Reference Management (Aggregate Behavior)
  // ==========================================================================

  /**
   * Get all references (immutable view)
   *
   * @returns Readonly array of references
   */
  getReferences(): readonly ExternalReferenceVO[] {
    return Object.freeze([...this._references]);
  }

  /**
   * Check if a reference exists in the collection
   *
   * @param refHash - Reference hash to check
   * @returns True if reference exists
   */
  hasReference(refHash: ReferenceHash): boolean {
    return this._references.some(ref => ref.referenceHash === refHash);
  }

  /**
   * Get a reference by its hash
   *
   * @param refHash - Reference hash to find
   * @returns The reference or null if not found
   */
  getReference(refHash: ReferenceHash): ExternalReferenceVO | null {
    return this._references.find(ref => ref.referenceHash === refHash) ?? null;
  }

  /**
   * Add a reference to the collection
   * Enforces aggregate invariants:
   * - No duplicate references (by hash)
   * - Maximum reference limit
   *
   * @param ref - Reference to add
   * @throws DomainError if invariant would be violated
   *
   * @example
   * ```typescript
   * entry.addReference(arnReference);
   * ```
   */
  addReference(ref: ExternalReferenceVO): void {
    // Invariant: No duplicate references
    if (this.hasReference(ref.referenceHash)) {
      throw new DomainError(
        'Reference already exists in entry',
        'DUPLICATE_REFERENCE',
        { referenceHash: ref.referenceHash }
      );
    }

    // Invariant: Maximum references per entry
    const MAX_REFERENCES_PER_ENTRY = 1000;
    if (this._references.length >= MAX_REFERENCES_PER_ENTRY) {
      throw new DomainError(
        `Maximum references per entry exceeded (${MAX_REFERENCES_PER_ENTRY})`,
        'MAX_REFERENCES_EXCEEDED',
        { current: this._references.length, max: MAX_REFERENCES_PER_ENTRY }
      );
    }

    this._references.push(ref);
    this._updatedAt = new Date();
  }

  /**
   * Add multiple references at once
   * Atomic operation - all or nothing
   *
   * @param refs - References to add
   * @throws DomainError if any invariant would be violated
   */
  addReferences(refs: ExternalReferenceVO[]): void {
    // Pre-validate all references before adding any
    for (const ref of refs) {
      if (this.hasReference(ref.referenceHash)) {
        throw new DomainError(
          'Reference already exists in entry',
          'DUPLICATE_REFERENCE',
          { referenceHash: ref.referenceHash }
        );
      }
    }

    const MAX_REFERENCES_PER_ENTRY = 1000;
    if (this._references.length + refs.length > MAX_REFERENCES_PER_ENTRY) {
      throw new DomainError(
        `Adding ${refs.length} references would exceed maximum (${MAX_REFERENCES_PER_ENTRY})`,
        'MAX_REFERENCES_EXCEEDED',
        {
          current: this._references.length,
          adding: refs.length,
          max: MAX_REFERENCES_PER_ENTRY,
        }
      );
    }

    // All validations passed, add all references
    this._references.push(...refs);
    this._updatedAt = new Date();
  }

  /**
   * Remove a reference from the collection
   *
   * @param refHash - Reference hash to remove
   * @returns True if reference was removed, false if not found
   */
  removeReference(refHash: ReferenceHash): boolean {
    const index = this._references.findIndex(ref => ref.referenceHash === refHash);
    if (index === -1) {
      return false;
    }

    this._references.splice(index, 1);
    this._updatedAt = new Date();
    return true;
  }

  /**
   * Clear all references from the collection
   */
  clearReferences(): void {
    if (this._references.length > 0) {
      this._references = [];
      this._updatedAt = new Date();
    }
  }

  /**
   * Replace all references with a new collection
   * Atomic operation
   *
   * @param refs - New references to set
   */
  replaceReferences(refs: ExternalReferenceVO[]): void {
    // Check for duplicates in the new collection
    const hashes = new Set<ReferenceHash>();
    for (const ref of refs) {
      if (hashes.has(ref.referenceHash)) {
        throw new DomainError(
          'Duplicate reference in replacement set',
          'DUPLICATE_REFERENCE',
          { referenceHash: ref.referenceHash }
        );
      }
      hashes.add(ref.referenceHash);
    }

    const MAX_REFERENCES_PER_ENTRY = 1000;
    if (refs.length > MAX_REFERENCES_PER_ENTRY) {
      throw new DomainError(
        `Replacement set exceeds maximum references (${MAX_REFERENCES_PER_ENTRY})`,
        'MAX_REFERENCES_EXCEEDED',
        { count: refs.length, max: MAX_REFERENCES_PER_ENTRY }
      );
    }

    this._references = [...refs];
    this._updatedAt = new Date();
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Find references by type
   *
   * @param refType - Reference type to filter by
   * @returns Array of matching references
   */
  findByType(refType: string): ExternalReferenceVO[] {
    return this._references.filter(ref => ref.refType === refType);
  }

  /**
   * Find references by provider
   *
   * @param provider - Cloud provider to filter by
   * @returns Array of matching references
   */
  findByProvider(provider: string): ExternalReferenceVO[] {
    return this._references.filter(ref => ref.provider === provider);
  }

  /**
   * Find references by identifier prefix
   *
   * @param prefix - Identifier prefix to match
   * @returns Array of matching references
   */
  findByIdentifierPrefix(prefix: string): ExternalReferenceVO[] {
    const lowerPrefix = prefix.toLowerCase();
    return this._references.filter(
      ref => ref.normalizedIdentifier.startsWith(lowerPrefix)
    );
  }

  /**
   * Find references with confidence above threshold
   *
   * @param threshold - Minimum confidence (0.0 to 1.0)
   * @returns Array of matching references
   */
  findByMinConfidence(threshold: number): ExternalReferenceVO[] {
    return this._references.filter(ref => ref.confidence >= threshold);
  }

  // ==========================================================================
  // Equality & Comparison
  // ==========================================================================

  /**
   * Check equality with another aggregate (by ID)
   *
   * @param other - Other aggregate to compare
   * @returns True if same aggregate (same ID)
   */
  equals(other: IndexEntryAggregate): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this.id === other.id;
  }

  /**
   * Check if references have changed compared to another entry
   *
   * @param other - Other entry to compare
   * @returns True if references are different
   */
  referencesChanged(other: IndexEntryAggregate): boolean {
    return this.collectionHash !== other.collectionHash;
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object for serialization
   *
   * @returns Plain object representation
   */
  toJSON(): IndexEntryDTO {
    return {
      id: this.id,
      nodeId: this.nodeId,
      scanId: this.scanId,
      repositoryId: this.repositoryId,
      tenantId: this.tenantId,
      references: this._references.map(ref => ref.toJSON()),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `IndexEntry(${this.id}, node=${this.nodeId}, refs=${this.referenceCount})`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an index entry for a node with initial references
 *
 * @param params - Entry creation parameters
 * @param references - Initial references to add
 * @returns Result containing the entry or validation error
 */
export function createIndexEntryWithReferences(
  params: CreateIndexEntryParams,
  references: ExternalReferenceVO[]
): ValidationResult<IndexEntryAggregate> {
  const entryResult = IndexEntryAggregate.create(params);

  if (Result.isErr(entryResult)) {
    return entryResult;
  }

  try {
    entryResult.value.addReferences(references);
    return Result.ok(entryResult.value);
  } catch (error) {
    if (error instanceof DomainError) {
      return Result.err(
        new ValidationError(error.message, error.code, undefined, error.context)
      );
    }
    throw error;
  }
}

/**
 * Create multiple index entries from a batch of nodes
 *
 * @param nodes - Array of node data with references
 * @param context - Common context (scanId, repositoryId, tenantId)
 * @returns Array of Results for each entry
 */
export function createIndexEntriesBatch(
  nodes: Array<{
    nodeId: string;
    references: ExternalReferenceVO[];
  }>,
  context: {
    scanId: ScanId;
    repositoryId: RepositoryId;
    tenantId: TenantId;
  }
): ValidationResult<IndexEntryAggregate>[] {
  return nodes.map(node =>
    createIndexEntryWithReferences(
      {
        nodeId: node.nodeId,
        scanId: context.scanId,
        repositoryId: context.repositoryId,
        tenantId: context.tenantId,
      },
      node.references
    )
  );
}
