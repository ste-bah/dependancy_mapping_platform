/**
 * Fixture Repository
 * @module e2e/data/fixture-repository
 *
 * Repository for persisting and retrieving test fixtures.
 * Supports versioning, bulk operations, and fixture metadata.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #23 of 47 | Phase 4: Implementation
 */

import type { Result, AsyncResult, Brand } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';
import type { TenantId, RepositoryId, ScanId } from '../../api/src/types/entities.js';
import type {
  TerraformFixture,
  HelmFixture,
  UserFixture,
  GraphFixture,
  GraphNodeFixture,
  GraphEdgeFixture,
  TenantFixture,
  RepositoryFixture,
  ScanFixture,
} from '../types/fixture-types.js';
import type { FixtureId } from '../types/test-types.js';
import { createFixtureId } from '../types/test-types.js';
import type { TestDatabase, TransactionId } from '../domain/test-database.js';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for Fixture Version
 */
export type FixtureVersion = Brand<string, 'FixtureVersion'>;

/**
 * Create a FixtureVersion from a string
 */
export function createFixtureVersion(version: string): FixtureVersion {
  return version as FixtureVersion;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Fixture type discriminator
 */
export type FixtureType =
  | 'terraform'
  | 'helm'
  | 'user'
  | 'tenant'
  | 'repository'
  | 'scan'
  | 'graph'
  | 'custom';

/**
 * Stored fixture envelope
 */
export interface StoredFixture<T = unknown> {
  /** Unique fixture ID */
  readonly id: FixtureId;
  /** Fixture type */
  readonly type: FixtureType;
  /** Fixture name */
  readonly name: string;
  /** Fixture version */
  readonly version: FixtureVersion;
  /** Fixture data */
  readonly data: T;
  /** Tags for categorization */
  readonly tags: ReadonlyArray<string>;
  /** Fixture metadata */
  readonly metadata: FixtureMetadata;
  /** Created timestamp */
  readonly createdAt: Date;
  /** Updated timestamp */
  readonly updatedAt: Date;
}

/**
 * Fixture metadata
 */
export interface FixtureMetadata {
  /** Description */
  readonly description?: string;
  /** Source file path */
  readonly sourcePath?: string;
  /** Dependencies on other fixtures */
  readonly dependencies: ReadonlyArray<FixtureId>;
  /** Checksum for validation */
  readonly checksum?: string;
  /** Custom metadata */
  readonly custom: Readonly<Record<string, unknown>>;
}

/**
 * Fixture filter criteria
 */
export interface FixtureFilterCriteria {
  /** Filter by type */
  readonly type?: FixtureType | ReadonlyArray<FixtureType>;
  /** Filter by tags (any match) */
  readonly tags?: ReadonlyArray<string>;
  /** Filter by name pattern (regex) */
  readonly namePattern?: string;
  /** Filter by version */
  readonly version?: FixtureVersion;
  /** Filter by creation date (after) */
  readonly createdAfter?: Date;
  /** Filter by creation date (before) */
  readonly createdBefore?: Date;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  readonly data: ReadonlyArray<T>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  readonly inserted: number;
  readonly updated: number;
  readonly failed: number;
  readonly errors: ReadonlyArray<{ index: number; error: string }>;
}

/**
 * Fixture create input
 */
export interface CreateFixtureInput<T = unknown> {
  readonly type: FixtureType;
  readonly name: string;
  readonly data: T;
  readonly version?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly description?: string;
  readonly sourcePath?: string;
  readonly dependencies?: ReadonlyArray<string>;
  readonly custom?: Readonly<Record<string, unknown>>;
}

/**
 * Fixture update input
 */
export interface UpdateFixtureInput<T = unknown> {
  readonly data?: T;
  readonly name?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly description?: string;
  readonly custom?: Readonly<Record<string, unknown>>;
  /** Increment version automatically */
  readonly autoVersion?: boolean;
}

/**
 * Repository error
 */
export interface FixtureRepositoryError {
  readonly code: FixtureRepositoryErrorCode;
  readonly message: string;
  readonly fixtureId?: FixtureId;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Error codes
 */
export type FixtureRepositoryErrorCode =
  | 'FIXTURE_NOT_FOUND'
  | 'FIXTURE_EXISTS'
  | 'VERSION_CONFLICT'
  | 'INVALID_INPUT'
  | 'DATABASE_ERROR'
  | 'SERIALIZATION_ERROR';

// ============================================================================
// Interface
// ============================================================================

/**
 * Fixture repository interface
 */
export interface IFixtureRepository {
  /**
   * Store a fixture
   */
  store<T>(input: CreateFixtureInput<T>): AsyncResult<StoredFixture<T>, FixtureRepositoryError>;

  /**
   * Retrieve a fixture by ID
   */
  retrieve<T>(id: FixtureId): AsyncResult<StoredFixture<T>, FixtureRepositoryError>;

  /**
   * Retrieve a fixture by name
   */
  retrieveByName<T>(name: string): AsyncResult<StoredFixture<T>, FixtureRepositoryError>;

  /**
   * Update a fixture
   */
  update<T>(id: FixtureId, input: UpdateFixtureInput<T>): AsyncResult<StoredFixture<T>, FixtureRepositoryError>;

  /**
   * Delete a fixture
   */
  delete(id: FixtureId): AsyncResult<void, FixtureRepositoryError>;

  /**
   * Find fixtures by criteria
   */
  find<T>(
    criteria: FixtureFilterCriteria,
    pagination?: PaginationParams
  ): AsyncResult<PaginatedResult<StoredFixture<T>>, FixtureRepositoryError>;

  /**
   * Find all fixtures of a type
   */
  findByType<T>(type: FixtureType): AsyncResult<ReadonlyArray<StoredFixture<T>>, FixtureRepositoryError>;

  /**
   * Find all versions of a fixture
   */
  findVersions(name: string): AsyncResult<ReadonlyArray<StoredFixture<unknown>>, FixtureRepositoryError>;

  /**
   * Bulk store fixtures
   */
  bulkStore<T>(fixtures: ReadonlyArray<CreateFixtureInput<T>>): AsyncResult<BulkOperationResult, FixtureRepositoryError>;

  /**
   * Bulk delete fixtures
   */
  bulkDelete(ids: ReadonlyArray<FixtureId>): AsyncResult<BulkOperationResult, FixtureRepositoryError>;

  /**
   * Check if fixture exists
   */
  exists(id: FixtureId): Promise<boolean>;

  /**
   * Count fixtures
   */
  count(criteria?: FixtureFilterCriteria): Promise<number>;

  /**
   * Clear all fixtures
   */
  clear(): AsyncResult<void, FixtureRepositoryError>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * In-memory fixture repository implementation
 * Suitable for test scenarios where database is not available
 */
export class InMemoryFixtureRepository implements IFixtureRepository {
  private readonly fixtures: Map<FixtureId, StoredFixture<unknown>>;
  private readonly nameIndex: Map<string, FixtureId>;
  private idCounter: number;

  constructor() {
    this.fixtures = new Map();
    this.nameIndex = new Map();
    this.idCounter = 0;
  }

  async store<T>(input: CreateFixtureInput<T>): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    // Check for duplicate name
    if (this.nameIndex.has(input.name)) {
      return failure({
        code: 'FIXTURE_EXISTS',
        message: `Fixture with name "${input.name}" already exists`,
      });
    }

    const id = createFixtureId(`fixture_${++this.idCounter}`);
    const version = createFixtureVersion(input.version ?? '1.0.0');
    const now = new Date();

    const fixture: StoredFixture<T> = {
      id,
      type: input.type,
      name: input.name,
      version,
      data: input.data,
      tags: input.tags ?? [],
      metadata: {
        description: input.description,
        sourcePath: input.sourcePath,
        dependencies: (input.dependencies ?? []).map(d => createFixtureId(d)),
        custom: input.custom ?? {},
      },
      createdAt: now,
      updatedAt: now,
    };

    this.fixtures.set(id, fixture as StoredFixture<unknown>);
    this.nameIndex.set(input.name, id);

    return success(fixture);
  }

  async retrieve<T>(id: FixtureId): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    const fixture = this.fixtures.get(id);
    if (!fixture) {
      return failure({
        code: 'FIXTURE_NOT_FOUND',
        message: `Fixture "${id}" not found`,
        fixtureId: id,
      });
    }
    return success(fixture as StoredFixture<T>);
  }

  async retrieveByName<T>(name: string): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    const id = this.nameIndex.get(name);
    if (!id) {
      return failure({
        code: 'FIXTURE_NOT_FOUND',
        message: `Fixture with name "${name}" not found`,
      });
    }
    return this.retrieve(id);
  }

  async update<T>(
    id: FixtureId,
    input: UpdateFixtureInput<T>
  ): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    const existing = this.fixtures.get(id);
    if (!existing) {
      return failure({
        code: 'FIXTURE_NOT_FOUND',
        message: `Fixture "${id}" not found`,
        fixtureId: id,
      });
    }

    // Handle name change
    if (input.name && input.name !== existing.name) {
      if (this.nameIndex.has(input.name)) {
        return failure({
          code: 'FIXTURE_EXISTS',
          message: `Fixture with name "${input.name}" already exists`,
          fixtureId: id,
        });
      }
      this.nameIndex.delete(existing.name);
      this.nameIndex.set(input.name, id);
    }

    const newVersion = input.autoVersion
      ? this.incrementVersion(existing.version)
      : existing.version;

    const updated: StoredFixture<T> = {
      ...existing,
      name: input.name ?? existing.name,
      version: newVersion,
      data: input.data ?? existing.data,
      tags: input.tags ?? existing.tags,
      metadata: {
        ...existing.metadata,
        description: input.description ?? existing.metadata.description,
        custom: { ...existing.metadata.custom, ...input.custom },
      },
      updatedAt: new Date(),
    } as StoredFixture<T>;

    this.fixtures.set(id, updated as StoredFixture<unknown>);
    return success(updated);
  }

  async delete(id: FixtureId): AsyncResult<void, FixtureRepositoryError> {
    const fixture = this.fixtures.get(id);
    if (!fixture) {
      return failure({
        code: 'FIXTURE_NOT_FOUND',
        message: `Fixture "${id}" not found`,
        fixtureId: id,
      });
    }

    this.fixtures.delete(id);
    this.nameIndex.delete(fixture.name);
    return success(undefined);
  }

  async find<T>(
    criteria: FixtureFilterCriteria,
    pagination?: PaginationParams
  ): AsyncResult<PaginatedResult<StoredFixture<T>>, FixtureRepositoryError> {
    let results = Array.from(this.fixtures.values());

    // Apply filters
    if (criteria.type) {
      const types = Array.isArray(criteria.type) ? criteria.type : [criteria.type];
      results = results.filter(f => types.includes(f.type));
    }

    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(f =>
        criteria.tags!.some(tag => f.tags.includes(tag))
      );
    }

    if (criteria.namePattern) {
      const regex = new RegExp(criteria.namePattern);
      results = results.filter(f => regex.test(f.name));
    }

    if (criteria.version) {
      results = results.filter(f => f.version === criteria.version);
    }

    if (criteria.createdAfter) {
      results = results.filter(f => f.createdAt > criteria.createdAfter!);
    }

    if (criteria.createdBefore) {
      results = results.filter(f => f.createdAt < criteria.createdBefore!);
    }

    const total = results.length;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 50;
    const totalPages = Math.ceil(total / pageSize);

    // Apply pagination
    const start = (page - 1) * pageSize;
    const paginatedResults = results.slice(start, start + pageSize);

    return success({
      data: paginatedResults as ReadonlyArray<StoredFixture<T>>,
      total,
      page,
      pageSize,
      totalPages,
    });
  }

  async findByType<T>(type: FixtureType): AsyncResult<ReadonlyArray<StoredFixture<T>>, FixtureRepositoryError> {
    const results = Array.from(this.fixtures.values())
      .filter(f => f.type === type);
    return success(results as ReadonlyArray<StoredFixture<T>>);
  }

  async findVersions(name: string): AsyncResult<ReadonlyArray<StoredFixture<unknown>>, FixtureRepositoryError> {
    // In this simple implementation, we only have one version per name
    const id = this.nameIndex.get(name);
    if (!id) {
      return success([]);
    }
    const fixture = this.fixtures.get(id);
    return success(fixture ? [fixture] : []);
  }

  async bulkStore<T>(
    fixtures: ReadonlyArray<CreateFixtureInput<T>>
  ): AsyncResult<BulkOperationResult, FixtureRepositoryError> {
    let inserted = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < fixtures.length; i++) {
      const result = await this.store(fixtures[i]);
      if (result.success) {
        inserted++;
      } else {
        failed++;
        errors.push({ index: i, error: result.error.message });
      }
    }

    return success({ inserted, updated: 0, failed, errors });
  }

  async bulkDelete(ids: ReadonlyArray<FixtureId>): AsyncResult<BulkOperationResult, FixtureRepositoryError> {
    let deleted = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < ids.length; i++) {
      const result = await this.delete(ids[i]);
      if (result.success) {
        deleted++;
      } else {
        failed++;
        errors.push({ index: i, error: result.error.message });
      }
    }

    return success({ inserted: deleted, updated: 0, failed, errors });
  }

  async exists(id: FixtureId): Promise<boolean> {
    return this.fixtures.has(id);
  }

  async count(criteria?: FixtureFilterCriteria): Promise<number> {
    if (!criteria) {
      return this.fixtures.size;
    }
    const result = await this.find(criteria);
    return result.success ? result.value.total : 0;
  }

  async clear(): AsyncResult<void, FixtureRepositoryError> {
    this.fixtures.clear();
    this.nameIndex.clear();
    this.idCounter = 0;
    return success(undefined);
  }

  private incrementVersion(version: FixtureVersion): FixtureVersion {
    const parts = (version as string).split('.').map(Number);
    parts[2] = (parts[2] ?? 0) + 1;
    return createFixtureVersion(parts.join('.'));
  }
}

/**
 * Database-backed fixture repository implementation
 */
export class DatabaseFixtureRepository implements IFixtureRepository {
  constructor(private readonly database: TestDatabase) {}

  async store<T>(input: CreateFixtureInput<T>): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    try {
      const id = createFixtureId(`fixture_${crypto.randomUUID()}`);
      const version = createFixtureVersion(input.version ?? '1.0.0');
      const now = new Date();

      const sql = `
        INSERT INTO test_fixtures (id, type, name, version, data, tags, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const metadata: FixtureMetadata = {
        description: input.description,
        sourcePath: input.sourcePath,
        dependencies: (input.dependencies ?? []).map(d => createFixtureId(d)),
        custom: input.custom ?? {},
      };

      const result = await this.database.query(sql, [
        id,
        input.type,
        input.name,
        version,
        JSON.stringify(input.data),
        JSON.stringify(input.tags ?? []),
        JSON.stringify(metadata),
        now,
        now,
      ]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      const fixture: StoredFixture<T> = {
        id,
        type: input.type,
        name: input.name,
        version,
        data: input.data,
        tags: input.tags ?? [],
        metadata,
        createdAt: now,
        updatedAt: now,
      };

      return success(fixture);
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async retrieve<T>(id: FixtureId): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    try {
      const sql = `SELECT * FROM test_fixtures WHERE id = $1`;
      const result = await this.database.query(sql, [id]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      if (result.value.rowCount === 0) {
        return failure({
          code: 'FIXTURE_NOT_FOUND',
          message: `Fixture "${id}" not found`,
          fixtureId: id,
        });
      }

      const row = result.value.rows[0];
      return success(this.mapRowToFixture<T>(row));
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async retrieveByName<T>(name: string): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    try {
      const sql = `SELECT * FROM test_fixtures WHERE name = $1 ORDER BY version DESC LIMIT 1`;
      const result = await this.database.query(sql, [name]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      if (result.value.rowCount === 0) {
        return failure({
          code: 'FIXTURE_NOT_FOUND',
          message: `Fixture with name "${name}" not found`,
        });
      }

      const row = result.value.rows[0];
      return success(this.mapRowToFixture<T>(row));
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async update<T>(
    id: FixtureId,
    input: UpdateFixtureInput<T>
  ): AsyncResult<StoredFixture<T>, FixtureRepositoryError> {
    try {
      const existingResult = await this.retrieve<T>(id);
      if (!existingResult.success) {
        return existingResult;
      }

      const existing = existingResult.value;
      const now = new Date();

      const newData = input.data ?? existing.data;
      const newName = input.name ?? existing.name;
      const newTags = input.tags ?? existing.tags;
      const newVersion = input.autoVersion
        ? this.incrementVersion(existing.version)
        : existing.version;
      const newMetadata: FixtureMetadata = {
        ...existing.metadata,
        description: input.description ?? existing.metadata.description,
        custom: { ...existing.metadata.custom, ...input.custom },
      };

      const sql = `
        UPDATE test_fixtures
        SET name = $2, data = $3, tags = $4, metadata = $5, version = $6, updated_at = $7
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.database.query(sql, [
        id,
        newName,
        JSON.stringify(newData),
        JSON.stringify(newTags),
        JSON.stringify(newMetadata),
        newVersion,
        now,
      ]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      return success({
        ...existing,
        name: newName,
        data: newData,
        tags: newTags,
        metadata: newMetadata,
        version: newVersion,
        updatedAt: now,
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async delete(id: FixtureId): AsyncResult<void, FixtureRepositoryError> {
    try {
      const sql = `DELETE FROM test_fixtures WHERE id = $1`;
      const result = await this.database.query(sql, [id]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      return success(undefined);
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async find<T>(
    criteria: FixtureFilterCriteria,
    pagination?: PaginationParams
  ): AsyncResult<PaginatedResult<StoredFixture<T>>, FixtureRepositoryError> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (criteria.type) {
        const types = Array.isArray(criteria.type) ? criteria.type : [criteria.type];
        conditions.push(`type = ANY($${paramIndex++})`);
        params.push(types);
      }

      if (criteria.tags && criteria.tags.length > 0) {
        conditions.push(`tags && $${paramIndex++}::jsonb`);
        params.push(JSON.stringify(criteria.tags));
      }

      if (criteria.namePattern) {
        conditions.push(`name ~ $${paramIndex++}`);
        params.push(criteria.namePattern);
      }

      if (criteria.version) {
        conditions.push(`version = $${paramIndex++}`);
        params.push(criteria.version);
      }

      if (criteria.createdAfter) {
        conditions.push(`created_at > $${paramIndex++}`);
        params.push(criteria.createdAfter);
      }

      if (criteria.createdBefore) {
        conditions.push(`created_at < $${paramIndex++}`);
        params.push(criteria.createdBefore);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const page = pagination?.page ?? 1;
      const pageSize = pagination?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;

      // Count total
      const countSql = `SELECT COUNT(*) as count FROM test_fixtures ${whereClause}`;
      const countResult = await this.database.query(countSql, params);

      if (!countResult.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: countResult.error.message,
        });
      }

      const total = parseInt(countResult.value.rows[0]?.count ?? '0', 10);

      // Fetch data
      const dataSql = `
        SELECT * FROM test_fixtures
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const dataResult = await this.database.query(dataSql, [...params, pageSize, offset]);

      if (!dataResult.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: dataResult.error.message,
        });
      }

      const data = dataResult.value.rows.map(row => this.mapRowToFixture<T>(row));

      return success({
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async findByType<T>(type: FixtureType): AsyncResult<ReadonlyArray<StoredFixture<T>>, FixtureRepositoryError> {
    const result = await this.find<T>({ type });
    return result.success ? success(result.value.data) : failure(result.error);
  }

  async findVersions(name: string): AsyncResult<ReadonlyArray<StoredFixture<unknown>>, FixtureRepositoryError> {
    try {
      const sql = `SELECT * FROM test_fixtures WHERE name = $1 ORDER BY version DESC`;
      const result = await this.database.query(sql, [name]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      const fixtures = result.value.rows.map(row => this.mapRowToFixture(row));
      return success(fixtures);
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async bulkStore<T>(
    fixtures: ReadonlyArray<CreateFixtureInput<T>>
  ): AsyncResult<BulkOperationResult, FixtureRepositoryError> {
    let inserted = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    // Use transaction for atomicity
    const txResult = await this.database.withTransaction(async () => {
      for (let i = 0; i < fixtures.length; i++) {
        const result = await this.store(fixtures[i]);
        if (result.success) {
          inserted++;
        } else {
          failed++;
          errors.push({ index: i, error: result.error.message });
        }
      }
    });

    if (!txResult.success) {
      return failure({
        code: 'DATABASE_ERROR',
        message: txResult.error.message,
      });
    }

    return success({ inserted, updated: 0, failed, errors });
  }

  async bulkDelete(ids: ReadonlyArray<FixtureId>): AsyncResult<BulkOperationResult, FixtureRepositoryError> {
    try {
      const sql = `DELETE FROM test_fixtures WHERE id = ANY($1)`;
      const result = await this.database.query(sql, [ids]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      return success({
        inserted: result.value.rowCount,
        updated: 0,
        failed: 0,
        errors: [],
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async exists(id: FixtureId): Promise<boolean> {
    const sql = `SELECT 1 FROM test_fixtures WHERE id = $1`;
    const result = await this.database.query(sql, [id]);
    return result.success && result.value.rowCount > 0;
  }

  async count(criteria?: FixtureFilterCriteria): Promise<number> {
    if (!criteria) {
      const result = await this.database.query(`SELECT COUNT(*) as count FROM test_fixtures`);
      return result.success ? parseInt(result.value.rows[0]?.count ?? '0', 10) : 0;
    }
    const findResult = await this.find(criteria);
    return findResult.success ? findResult.value.total : 0;
  }

  async clear(): AsyncResult<void, FixtureRepositoryError> {
    try {
      const result = await this.database.query(`DELETE FROM test_fixtures`);
      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }
      return success(undefined);
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private mapRowToFixture<T>(row: Record<string, unknown>): StoredFixture<T> {
    return {
      id: createFixtureId(row.id as string),
      type: row.type as FixtureType,
      name: row.name as string,
      version: createFixtureVersion(row.version as string),
      data: JSON.parse(row.data as string) as T,
      tags: JSON.parse(row.tags as string) as ReadonlyArray<string>,
      metadata: JSON.parse(row.metadata as string) as FixtureMetadata,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private incrementVersion(version: FixtureVersion): FixtureVersion {
    const parts = (version as string).split('.').map(Number);
    parts[2] = (parts[2] ?? 0) + 1;
    return createFixtureVersion(parts.join('.'));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an in-memory fixture repository
 */
export function createInMemoryFixtureRepository(): IFixtureRepository {
  return new InMemoryFixtureRepository();
}

/**
 * Create a database-backed fixture repository
 */
export function createDatabaseFixtureRepository(database: TestDatabase): IFixtureRepository {
  return new DatabaseFixtureRepository(database);
}

/**
 * Type guard for FixtureRepositoryError
 */
export function isFixtureRepositoryError(value: unknown): value is FixtureRepositoryError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
