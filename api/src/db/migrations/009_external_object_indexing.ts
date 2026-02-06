/**
 * Database Migration: External Object Indexing
 * @module db/migrations/009_external_object_indexing
 *
 * Creates tables for the External Object Index system:
 * - external_objects_master: Master table for unique external objects
 * - node_external_objects: Junction table for node-to-external relationships
 * - external_object_index: Denormalized index for fast lookups
 *
 * Includes Row-Level Security (RLS) policies for multi-tenancy.
 * Performance indexes optimized for NFR-PERF-008 (100K nodes < 500ms).
 *
 * TASK-ROLLUP-003: External Object Index database schema
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import pg from 'pg';

/**
 * Migration interface
 */
export interface Migration {
  readonly version: string;
  readonly name: string;
  up(client: pg.PoolClient): Promise<void>;
  down(client: pg.PoolClient): Promise<void>;
}

/**
 * Valid reference types for external objects
 */
const VALID_REF_TYPES = [
  'arn',
  'resource_id',
  'k8s_reference',
  'gcp_resource',
  'azure_resource',
  'container_image',
  'git_url',
  'storage_path',
];

/**
 * Migration configuration
 */
export const migration: Migration = {
  version: '009',
  name: 'external_object_indexing',

  /**
   * Apply migration - create external object indexing tables
   */
  async up(client: pg.PoolClient): Promise<void> {
    // ========================================================================
    // 1. Create external_objects_master table
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS external_objects_master (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        external_id VARCHAR(2048) NOT NULL,
        ref_type VARCHAR(100) NOT NULL,
        provider VARCHAR(50),
        normalized_id VARCHAR(2048) NOT NULL,
        reference_hash VARCHAR(64) NOT NULL,
        components JSONB DEFAULT '{}',
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reference_count INTEGER NOT NULL DEFAULT 1,

        CONSTRAINT uq_eom_tenant_hash UNIQUE (tenant_id, reference_hash),
        CONSTRAINT external_objects_ref_type_check CHECK (
          ref_type IN (${VALID_REF_TYPES.map((t) => `'${t}'`).join(', ')})
        )
      );

      -- Performance indexes for external_objects_master
      CREATE INDEX IF NOT EXISTS idx_eom_tenant_type ON external_objects_master(tenant_id, ref_type);
      CREATE INDEX IF NOT EXISTS idx_eom_reference_hash ON external_objects_master(reference_hash);
      CREATE INDEX IF NOT EXISTS idx_eom_normalized_id ON external_objects_master(tenant_id, normalized_id);
      CREATE INDEX IF NOT EXISTS idx_eom_provider ON external_objects_master(tenant_id, provider)
        WHERE provider IS NOT NULL;

      COMMENT ON TABLE external_objects_master IS 'Master table for unique external objects (ARNs, Resource IDs, K8s refs)';
      COMMENT ON COLUMN external_objects_master.reference_hash IS 'SHA-256 hash of ref_type:normalized_id for fast lookup';
      COMMENT ON COLUMN external_objects_master.normalized_id IS 'Lowercase, normalized version of external_id for matching';
    `);

    // ========================================================================
    // 2. Create node_external_objects junction table (Critical for NFR-PERF-008)
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS node_external_objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        node_id UUID NOT NULL,
        external_object_id UUID NOT NULL,
        scan_id UUID NOT NULL,
        repository_id UUID NOT NULL,
        reference_hash VARCHAR(64) NOT NULL,
        ref_type VARCHAR(100) NOT NULL,
        confidence DECIMAL(3,2) NOT NULL DEFAULT 1.00,
        context JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Unique constraint: one entry per node-external pair per scan
        CONSTRAINT uq_neo_scan_node_external UNIQUE (scan_id, node_id, external_object_id),

        -- Confidence must be between 0 and 1
        CONSTRAINT neo_confidence_check CHECK (confidence >= 0 AND confidence <= 1),

        -- Reference type validation
        CONSTRAINT neo_ref_type_check CHECK (
          ref_type IN (${VALID_REF_TYPES.map((t) => `'${t}'`).join(', ')})
        )
      );

      -- Performance Indexes for NFR-PERF-008 (8 strategic indexes)

      -- Index 1: Tenant + Repository composite
      CREATE INDEX IF NOT EXISTS idx_neo_tenant_repo
        ON node_external_objects(tenant_id, repository_id);

      -- Index 2: External object lookup (reverse lookup: external -> nodes)
      CREATE INDEX IF NOT EXISTS idx_neo_external_object
        ON node_external_objects(external_object_id);

      -- Index 3: Reference hash lookup (CRITICAL: < 20ms lookup target)
      CREATE INDEX IF NOT EXISTS idx_neo_reference_hash
        ON node_external_objects(reference_hash);

      -- Index 4: Node lookup (forward lookup: node -> externals)
      CREATE INDEX IF NOT EXISTS idx_neo_node_id
        ON node_external_objects(node_id);

      -- Index 5: Scan-based operations
      CREATE INDEX IF NOT EXISTS idx_neo_scan_id
        ON node_external_objects(scan_id);

      -- Index 6: Tenant + Ref Type
      CREATE INDEX IF NOT EXISTS idx_neo_tenant_ref_type
        ON node_external_objects(tenant_id, ref_type);

      -- Index 7: Covering index for pagination
      CREATE INDEX IF NOT EXISTS idx_neo_tenant_repo_created
        ON node_external_objects(tenant_id, repository_id, created_at DESC);

      -- Index 8: Confidence-based filtering
      CREATE INDEX IF NOT EXISTS idx_neo_confidence
        ON node_external_objects(tenant_id, confidence DESC)
        WHERE confidence >= 0.80;

      COMMENT ON TABLE node_external_objects IS 'Junction table for node-to-external-object relationships (NFR-PERF-008)';
      COMMENT ON COLUMN node_external_objects.reference_hash IS 'Pre-computed hash for O(1) lookup';
      COMMENT ON COLUMN node_external_objects.confidence IS 'Confidence score 0.0-1.0';
    `);

    // ========================================================================
    // 3. Create external_object_index table (Denormalized for performance)
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS external_object_index (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(2048) NOT NULL,
        reference_type VARCHAR(100) NOT NULL,
        normalized_id VARCHAR(2048) NOT NULL,
        tenant_id UUID NOT NULL,
        repository_id UUID NOT NULL,
        scan_id UUID NOT NULL,
        node_id VARCHAR(255) NOT NULL,
        node_name VARCHAR(500) NOT NULL,
        node_type VARCHAR(100) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        components JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Unique constraint for deduplication
        CONSTRAINT uq_eoi_tenant_node_external UNIQUE (tenant_id, node_id, external_id),

        -- Reference type validation
        CONSTRAINT eoi_ref_type_check CHECK (
          reference_type IN (${VALID_REF_TYPES.map((t) => `'${t}'`).join(', ')})
        )
      );

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_eoi_tenant_repo ON external_object_index(tenant_id, repository_id);
      CREATE INDEX IF NOT EXISTS idx_eoi_external_id ON external_object_index(tenant_id, external_id);
      CREATE INDEX IF NOT EXISTS idx_eoi_normalized_id ON external_object_index(tenant_id, normalized_id);
      CREATE INDEX IF NOT EXISTS idx_eoi_node_id ON external_object_index(tenant_id, node_id, scan_id);
      CREATE INDEX IF NOT EXISTS idx_eoi_scan_id ON external_object_index(scan_id);
      CREATE INDEX IF NOT EXISTS idx_eoi_ref_type ON external_object_index(tenant_id, reference_type);
      CREATE INDEX IF NOT EXISTS idx_eoi_indexed_at ON external_object_index(tenant_id, indexed_at DESC);

      -- GIN index for JSONB component searches
      CREATE INDEX IF NOT EXISTS idx_eoi_components ON external_object_index USING GIN (components);

      COMMENT ON TABLE external_object_index IS 'Denormalized index for fast external object lookups (NFR-PERF-008)';
    `);

    // ========================================================================
    // 4. Enable Row-Level Security (RLS)
    // ========================================================================
    await client.query(`
      -- Enable RLS on all tables
      ALTER TABLE external_objects_master ENABLE ROW LEVEL SECURITY;
      ALTER TABLE node_external_objects ENABLE ROW LEVEL SECURITY;
      ALTER TABLE external_object_index ENABLE ROW LEVEL SECURITY;

      -- RLS policy for external_objects_master
      DROP POLICY IF EXISTS eom_tenant_isolation ON external_objects_master;
      CREATE POLICY eom_tenant_isolation ON external_objects_master
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

      -- RLS policy for node_external_objects
      DROP POLICY IF EXISTS neo_tenant_isolation ON node_external_objects;
      CREATE POLICY neo_tenant_isolation ON node_external_objects
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

      -- RLS policy for external_object_index
      DROP POLICY IF EXISTS eoi_tenant_isolation ON external_object_index;
      CREATE POLICY eoi_tenant_isolation ON external_object_index
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
    `);

    // ========================================================================
    // 5. Create helper functions
    // ========================================================================
    await client.query(`
      -- Function to get nodes referencing an external object (with pagination)
      CREATE OR REPLACE FUNCTION get_nodes_by_external_object(
        p_tenant_id UUID,
        p_external_object_id UUID,
        p_limit INTEGER DEFAULT 100,
        p_offset INTEGER DEFAULT 0
      )
      RETURNS TABLE (
        node_id UUID,
        repository_id UUID,
        scan_id UUID,
        ref_type VARCHAR(100),
        confidence DECIMAL(3,2),
        context JSONB,
        created_at TIMESTAMPTZ,
        total_count BIGINT
      )
      LANGUAGE plpgsql
      STABLE
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          neo.node_id,
          neo.repository_id,
          neo.scan_id,
          neo.ref_type,
          neo.confidence,
          neo.context,
          neo.created_at,
          COUNT(*) OVER() AS total_count
        FROM node_external_objects neo
        WHERE neo.tenant_id = p_tenant_id
          AND neo.external_object_id = p_external_object_id
        ORDER BY neo.created_at DESC
        LIMIT p_limit
        OFFSET p_offset;
      END;
      $$;

      COMMENT ON FUNCTION get_nodes_by_external_object IS 'Reverse lookup: get all nodes referencing an external object with pagination';
    `);

    await client.query(`
      -- Function to get external object index statistics
      CREATE OR REPLACE FUNCTION get_external_object_index_stats(
        p_tenant_id UUID,
        p_repository_id UUID DEFAULT NULL
      )
      RETURNS TABLE (
        total_entries BIGINT,
        entries_by_type JSONB,
        unique_external_objects BIGINT,
        unique_nodes BIGINT,
        avg_confidence NUMERIC,
        latest_indexed_at TIMESTAMPTZ
      )
      LANGUAGE plpgsql
      STABLE
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          COUNT(*)::BIGINT AS total_entries,
          (
            SELECT COALESCE(
              jsonb_object_agg(ref_type, cnt),
              '{}'::jsonb
            )
            FROM (
              SELECT ref_type, COUNT(*)::BIGINT AS cnt
              FROM node_external_objects
              WHERE tenant_id = p_tenant_id
                AND (p_repository_id IS NULL OR repository_id = p_repository_id)
              GROUP BY ref_type
            ) s
          ) AS entries_by_type,
          (
            SELECT COUNT(DISTINCT external_object_id)::BIGINT
            FROM node_external_objects
            WHERE tenant_id = p_tenant_id
              AND (p_repository_id IS NULL OR repository_id = p_repository_id)
          ) AS unique_external_objects,
          (
            SELECT COUNT(DISTINCT node_id)::BIGINT
            FROM node_external_objects
            WHERE tenant_id = p_tenant_id
              AND (p_repository_id IS NULL OR repository_id = p_repository_id)
          ) AS unique_nodes,
          (
            SELECT AVG(confidence)::NUMERIC(5,4)
            FROM node_external_objects
            WHERE tenant_id = p_tenant_id
              AND (p_repository_id IS NULL OR repository_id = p_repository_id)
          ) AS avg_confidence,
          (
            SELECT MAX(created_at)
            FROM node_external_objects
            WHERE tenant_id = p_tenant_id
              AND (p_repository_id IS NULL OR repository_id = p_repository_id)
          ) AS latest_indexed_at
        FROM node_external_objects
        WHERE tenant_id = p_tenant_id
          AND (p_repository_id IS NULL OR repository_id = p_repository_id);
      END;
      $$;

      COMMENT ON FUNCTION get_external_object_index_stats IS 'Get statistics for the external object index';
    `);

    await client.query(`
      -- Function to bulk insert index entries efficiently
      CREATE OR REPLACE FUNCTION bulk_insert_external_object_index(
        p_entries JSONB
      )
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_inserted INTEGER := 0;
      BEGIN
        INSERT INTO node_external_objects (
          tenant_id,
          node_id,
          external_object_id,
          scan_id,
          repository_id,
          reference_hash,
          ref_type,
          confidence,
          context
        )
        SELECT
          (entry->>'tenant_id')::UUID,
          (entry->>'node_id')::UUID,
          (entry->>'external_object_id')::UUID,
          (entry->>'scan_id')::UUID,
          (entry->>'repository_id')::UUID,
          entry->>'reference_hash',
          entry->>'ref_type',
          COALESCE((entry->>'confidence')::DECIMAL(3,2), 1.00),
          COALESCE(entry->'context', '{}'::jsonb)
        FROM jsonb_array_elements(p_entries) AS entry
        ON CONFLICT (scan_id, node_id, external_object_id) DO NOTHING;

        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        RETURN v_inserted;
      END;
      $$;

      COMMENT ON FUNCTION bulk_insert_external_object_index IS 'Efficiently bulk insert index entries with conflict handling';
    `);

    // ========================================================================
    // 6. Create triggers
    // ========================================================================
    await client.query(`
      -- Trigger to update last_seen_at on external_objects_master
      CREATE OR REPLACE FUNCTION update_external_object_last_seen()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE external_objects_master
        SET last_seen_at = NOW(),
            reference_count = reference_count + 1
        WHERE id = NEW.external_object_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_update_external_object_last_seen ON node_external_objects;
      CREATE TRIGGER trg_update_external_object_last_seen
        AFTER INSERT ON node_external_objects
        FOR EACH ROW
        EXECUTE FUNCTION update_external_object_last_seen();
    `);
  },

  /**
   * Rollback migration - drop external object indexing tables
   */
  async down(client: pg.PoolClient): Promise<void> {
    // Drop triggers
    await client.query(`
      DROP TRIGGER IF EXISTS trg_update_external_object_last_seen ON node_external_objects;
      DROP FUNCTION IF EXISTS update_external_object_last_seen();
    `);

    // Drop helper functions
    await client.query(`
      DROP FUNCTION IF EXISTS bulk_insert_external_object_index(JSONB);
      DROP FUNCTION IF EXISTS get_external_object_index_stats(UUID, UUID);
      DROP FUNCTION IF EXISTS get_nodes_by_external_object(UUID, UUID, INTEGER, INTEGER);
    `);

    // Drop RLS policies
    await client.query(`
      DROP POLICY IF EXISTS eoi_tenant_isolation ON external_object_index;
      DROP POLICY IF EXISTS neo_tenant_isolation ON node_external_objects;
      DROP POLICY IF EXISTS eom_tenant_isolation ON external_objects_master;
    `);

    // Drop tables in reverse dependency order
    await client.query(`DROP TABLE IF EXISTS external_object_index CASCADE`);
    await client.query(`DROP TABLE IF EXISTS node_external_objects CASCADE`);
    await client.query(`DROP TABLE IF EXISTS external_objects_master CASCADE`);
  },
};

// ============================================================================
// Migration Runner Utility
// ============================================================================

/**
 * Run this migration directly
 */
export async function runMigration(
  client: pg.PoolClient,
  direction: 'up' | 'down'
): Promise<void> {
  if (direction === 'up') {
    await migration.up(client);
  } else {
    await migration.down(client);
  }
}

export default migration;
