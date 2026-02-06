/**
 * Database Migration: Graph Diff Tables
 * @module db/migrations/010_graph_diff_tables
 *
 * Creates tables for the Graph Diff system:
 * - graph_diffs: Main diff records storing comparison results between scans
 *
 * Includes Row-Level Security (RLS) policies for multi-tenancy.
 * Performance indexes optimized for common diff queries.
 *
 * TASK-ROLLUP-005: Diff Computation database schema
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
 * Valid impact assessment levels
 */
const VALID_IMPACT_LEVELS = ['low', 'medium', 'high', 'critical'];

/**
 * Migration configuration
 */
export const migration: Migration = {
  version: '010',
  name: 'graph_diff_tables',

  /**
   * Apply migration - create graph diff tables
   */
  async up(client: pg.PoolClient): Promise<void> {
    // ========================================================================
    // 1. Create graph_diffs table
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS graph_diffs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        base_scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        compare_scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,

        -- Summary counts (denormalized for performance)
        nodes_added_count INTEGER NOT NULL DEFAULT 0,
        nodes_removed_count INTEGER NOT NULL DEFAULT 0,
        nodes_modified_count INTEGER NOT NULL DEFAULT 0,
        edges_added_count INTEGER NOT NULL DEFAULT 0,
        edges_removed_count INTEGER NOT NULL DEFAULT 0,
        edges_modified_count INTEGER NOT NULL DEFAULT 0,

        -- Impact assessment
        impact_assessment VARCHAR(20) NOT NULL DEFAULT 'low',
        computation_time_ms INTEGER NOT NULL DEFAULT 0,

        -- Full diff data as JSONB
        diff_data JSONB,

        -- Timestamps
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT graph_diffs_scan_pair_unique UNIQUE (tenant_id, base_scan_id, compare_scan_id),
        CONSTRAINT graph_diffs_different_scans CHECK (base_scan_id <> compare_scan_id),
        CONSTRAINT graph_diffs_impact_check CHECK (
          impact_assessment IN (${VALID_IMPACT_LEVELS.map((l) => `'${l}'`).join(', ')})
        ),
        CONSTRAINT graph_diffs_counts_non_negative CHECK (
          nodes_added_count >= 0
          AND nodes_removed_count >= 0
          AND nodes_modified_count >= 0
          AND edges_added_count >= 0
          AND edges_removed_count >= 0
          AND edges_modified_count >= 0
        ),
        CONSTRAINT graph_diffs_computation_time_non_negative CHECK (computation_time_ms >= 0)
      );

      -- Performance Indexes for graph_diffs

      -- Index 1: Tenant isolation (primary filter)
      CREATE INDEX IF NOT EXISTS idx_graph_diffs_tenant
        ON graph_diffs(tenant_id);

      -- Index 2: Repository-based lookups with time ordering
      CREATE INDEX IF NOT EXISTS idx_graph_diffs_repository
        ON graph_diffs(tenant_id, repository_id, computed_at DESC);

      -- Index 3: Base scan lookups (find all diffs from a specific base)
      CREATE INDEX IF NOT EXISTS idx_graph_diffs_base_scan
        ON graph_diffs(base_scan_id);

      -- Index 4: Compare scan lookups (find all diffs comparing to a specific scan)
      CREATE INDEX IF NOT EXISTS idx_graph_diffs_compare_scan
        ON graph_diffs(compare_scan_id);

      -- Index 5: Time-based queries
      CREATE INDEX IF NOT EXISTS idx_graph_diffs_computed_at
        ON graph_diffs(tenant_id, computed_at DESC);

      -- Index 6: Impact-based filtering
      CREATE INDEX IF NOT EXISTS idx_graph_diffs_impact
        ON graph_diffs(tenant_id, impact_assessment)
        WHERE impact_assessment IN ('high', 'critical');

      -- Index 7: Scan pair lookup (both scans)
      CREATE INDEX IF NOT EXISTS idx_graph_diffs_scan_pair
        ON graph_diffs(tenant_id, base_scan_id, compare_scan_id);

      -- Table comments
      COMMENT ON TABLE graph_diffs IS 'Diff computation results between two scans of the same repository';
      COMMENT ON COLUMN graph_diffs.tenant_id IS 'Tenant owning this diff record';
      COMMENT ON COLUMN graph_diffs.repository_id IS 'Repository being compared';
      COMMENT ON COLUMN graph_diffs.base_scan_id IS 'Base scan for comparison (older/reference)';
      COMMENT ON COLUMN graph_diffs.compare_scan_id IS 'Scan being compared to base (newer/current)';
      COMMENT ON COLUMN graph_diffs.nodes_added_count IS 'Number of nodes added in compare scan';
      COMMENT ON COLUMN graph_diffs.nodes_removed_count IS 'Number of nodes removed from base scan';
      COMMENT ON COLUMN graph_diffs.nodes_modified_count IS 'Number of nodes modified between scans';
      COMMENT ON COLUMN graph_diffs.edges_added_count IS 'Number of edges added in compare scan';
      COMMENT ON COLUMN graph_diffs.edges_removed_count IS 'Number of edges removed from base scan';
      COMMENT ON COLUMN graph_diffs.edges_modified_count IS 'Number of edges modified between scans';
      COMMENT ON COLUMN graph_diffs.impact_assessment IS 'Overall impact level: low, medium, high, critical';
      COMMENT ON COLUMN graph_diffs.computation_time_ms IS 'Time taken to compute the diff in milliseconds';
      COMMENT ON COLUMN graph_diffs.diff_data IS 'Full diff data including node/edge changes as JSONB';
      COMMENT ON COLUMN graph_diffs.computed_at IS 'When the diff was computed';
    `);

    // ========================================================================
    // 2. Enable Row-Level Security (RLS)
    // ========================================================================
    await client.query(`
      -- Enable RLS on graph_diffs table
      ALTER TABLE graph_diffs ENABLE ROW LEVEL SECURITY;

      -- RLS policy for graph_diffs
      DROP POLICY IF EXISTS graph_diffs_tenant_isolation ON graph_diffs;
      CREATE POLICY graph_diffs_tenant_isolation ON graph_diffs
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
    `);

    // ========================================================================
    // 3. Create helper functions
    // ========================================================================
    await client.query(`
      -- Function to get diff summary statistics
      CREATE OR REPLACE FUNCTION get_graph_diff_summary(p_diff_id UUID)
      RETURNS TABLE (
        total_node_changes BIGINT,
        total_edge_changes BIGINT,
        impact_assessment VARCHAR(20),
        change_breakdown JSONB
      )
      LANGUAGE plpgsql
      STABLE
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          (gd.nodes_added_count + gd.nodes_removed_count + gd.nodes_modified_count)::BIGINT AS total_node_changes,
          (gd.edges_added_count + gd.edges_removed_count + gd.edges_modified_count)::BIGINT AS total_edge_changes,
          gd.impact_assessment,
          jsonb_build_object(
            'nodes', jsonb_build_object(
              'added', gd.nodes_added_count,
              'removed', gd.nodes_removed_count,
              'modified', gd.nodes_modified_count
            ),
            'edges', jsonb_build_object(
              'added', gd.edges_added_count,
              'removed', gd.edges_removed_count,
              'modified', gd.edges_modified_count
            )
          ) AS change_breakdown
        FROM graph_diffs gd
        WHERE gd.id = p_diff_id;
      END;
      $$;

      COMMENT ON FUNCTION get_graph_diff_summary IS 'Returns summary statistics for a graph diff';
    `);

    await client.query(`
      -- Function to get repository diff history
      CREATE OR REPLACE FUNCTION get_repository_diff_history(
        p_tenant_id UUID,
        p_repository_id UUID,
        p_limit INTEGER DEFAULT 10,
        p_offset INTEGER DEFAULT 0
      )
      RETURNS TABLE (
        diff_id UUID,
        base_scan_id UUID,
        compare_scan_id UUID,
        impact_assessment VARCHAR(20),
        total_changes INTEGER,
        computed_at TIMESTAMPTZ,
        total_count BIGINT
      )
      LANGUAGE plpgsql
      STABLE
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          gd.id AS diff_id,
          gd.base_scan_id,
          gd.compare_scan_id,
          gd.impact_assessment,
          (gd.nodes_added_count + gd.nodes_removed_count + gd.nodes_modified_count +
           gd.edges_added_count + gd.edges_removed_count + gd.edges_modified_count) AS total_changes,
          gd.computed_at,
          COUNT(*) OVER() AS total_count
        FROM graph_diffs gd
        WHERE gd.tenant_id = p_tenant_id
          AND gd.repository_id = p_repository_id
        ORDER BY gd.computed_at DESC
        LIMIT p_limit
        OFFSET p_offset;
      END;
      $$;

      COMMENT ON FUNCTION get_repository_diff_history IS 'Returns paginated diff history for a repository';
    `);

    await client.query(`
      -- Function to find existing diff between two scans
      CREATE OR REPLACE FUNCTION find_existing_diff(
        p_tenant_id UUID,
        p_base_scan_id UUID,
        p_compare_scan_id UUID
      )
      RETURNS TABLE (
        diff_id UUID,
        computed_at TIMESTAMPTZ,
        impact_assessment VARCHAR(20)
      )
      LANGUAGE plpgsql
      STABLE
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          gd.id AS diff_id,
          gd.computed_at,
          gd.impact_assessment
        FROM graph_diffs gd
        WHERE gd.tenant_id = p_tenant_id
          AND gd.base_scan_id = p_base_scan_id
          AND gd.compare_scan_id = p_compare_scan_id
        LIMIT 1;
      END;
      $$;

      COMMENT ON FUNCTION find_existing_diff IS 'Check if a diff already exists between two scans';
    `);

    await client.query(`
      -- Function to get impact assessment statistics
      CREATE OR REPLACE FUNCTION get_diff_impact_stats(
        p_tenant_id UUID,
        p_repository_id UUID DEFAULT NULL,
        p_since TIMESTAMPTZ DEFAULT NULL
      )
      RETURNS TABLE (
        impact_level VARCHAR(20),
        diff_count BIGINT,
        percentage NUMERIC
      )
      LANGUAGE plpgsql
      STABLE
      AS $$
      DECLARE
        v_total BIGINT;
      BEGIN
        -- Get total count
        SELECT COUNT(*) INTO v_total
        FROM graph_diffs
        WHERE tenant_id = p_tenant_id
          AND (p_repository_id IS NULL OR repository_id = p_repository_id)
          AND (p_since IS NULL OR computed_at >= p_since);

        RETURN QUERY
        SELECT
          gd.impact_assessment AS impact_level,
          COUNT(*)::BIGINT AS diff_count,
          CASE WHEN v_total > 0
            THEN ROUND((COUNT(*)::NUMERIC / v_total) * 100, 2)
            ELSE 0
          END AS percentage
        FROM graph_diffs gd
        WHERE gd.tenant_id = p_tenant_id
          AND (p_repository_id IS NULL OR gd.repository_id = p_repository_id)
          AND (p_since IS NULL OR gd.computed_at >= p_since)
        GROUP BY gd.impact_assessment
        ORDER BY
          CASE gd.impact_assessment
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END;
      END;
      $$;

      COMMENT ON FUNCTION get_diff_impact_stats IS 'Get distribution of diff impact levels';
    `);
  },

  /**
   * Rollback migration - drop graph diff tables
   */
  async down(client: pg.PoolClient): Promise<void> {
    // Drop helper functions
    await client.query(`
      DROP FUNCTION IF EXISTS get_diff_impact_stats(UUID, UUID, TIMESTAMPTZ);
      DROP FUNCTION IF EXISTS find_existing_diff(UUID, UUID, UUID);
      DROP FUNCTION IF EXISTS get_repository_diff_history(UUID, UUID, INTEGER, INTEGER);
      DROP FUNCTION IF EXISTS get_graph_diff_summary(UUID);
    `);

    // Drop RLS policies
    await client.query(`
      DROP POLICY IF EXISTS graph_diffs_tenant_isolation ON graph_diffs;
    `);

    // Drop table (CASCADE will handle indexes)
    await client.query(`DROP TABLE IF EXISTS graph_diffs CASCADE`);
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
