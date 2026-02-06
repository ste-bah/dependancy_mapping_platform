/**
 * Database Migration: Rollup Tables
 * @module db/migrations/008_rollup_tables
 *
 * Creates tables for the Cross-Repository Aggregation (Rollup) system:
 * - rollups: Configuration for cross-repo aggregation
 * - rollup_executions: Execution tracking and results
 * - rollup_matches: Match results between nodes
 * - merged_nodes: Aggregated node results
 *
 * Includes Row-Level Security (RLS) policies for multi-tenancy.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation database schema
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
 * Migration configuration
 */
export const migration: Migration = {
  version: '008',
  name: 'rollup_tables',

  /**
   * Apply migration - create rollup tables
   */
  async up(client: pg.PoolClient): Promise<void> {
    // ========================================================================
    // 1. Create rollups table
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS rollups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        repository_ids UUID[] NOT NULL,
        scan_ids UUID[],
        matchers JSONB NOT NULL DEFAULT '[]'::jsonb,
        include_node_types TEXT[],
        exclude_node_types TEXT[],
        preserve_edge_types TEXT[],
        merge_options JSONB NOT NULL DEFAULT '{}'::jsonb,
        schedule JSONB,
        version INTEGER NOT NULL DEFAULT 1,
        created_by UUID NOT NULL,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_executed_at TIMESTAMPTZ,

        -- Constraints
        CONSTRAINT rollups_name_unique UNIQUE (tenant_id, name),
        CONSTRAINT rollups_status_check CHECK (
          status IN ('draft', 'active', 'executing', 'completed', 'failed', 'archived')
        ),
        CONSTRAINT rollups_repository_count_check CHECK (
          array_length(repository_ids, 1) >= 2
        ),
        CONSTRAINT rollups_matchers_check CHECK (
          jsonb_array_length(matchers) >= 1
        ),
        CONSTRAINT rollups_version_check CHECK (version >= 1)
      );

      -- Indexes for rollups
      CREATE INDEX IF NOT EXISTS idx_rollups_tenant_id ON rollups(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_rollups_status ON rollups(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_rollups_name ON rollups(tenant_id, name);
      CREATE INDEX IF NOT EXISTS idx_rollups_repository_ids ON rollups USING GIN (repository_ids);
      CREATE INDEX IF NOT EXISTS idx_rollups_created_at ON rollups(tenant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_rollups_last_executed ON rollups(tenant_id, last_executed_at DESC)
        WHERE last_executed_at IS NOT NULL;

      COMMENT ON TABLE rollups IS 'Cross-repository aggregation configurations';
      COMMENT ON COLUMN rollups.repository_ids IS 'Array of repository UUIDs to aggregate';
      COMMENT ON COLUMN rollups.matchers IS 'JSON array of matcher configurations (ARN, ResourceId, Name, Tag)';
      COMMENT ON COLUMN rollups.merge_options IS 'JSON object with conflict resolution and merge settings';
      COMMENT ON COLUMN rollups.version IS 'Optimistic locking version number';
    `);

    // ========================================================================
    // 2. Create rollup_executions table
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS rollup_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rollup_id UUID NOT NULL REFERENCES rollups(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        scan_ids UUID[] NOT NULL,
        stats JSONB,
        matches JSONB,
        merged_graph_id UUID,
        error_message TEXT,
        error_details JSONB,
        callback_url TEXT,
        options JSONB,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT rollup_executions_status_check CHECK (
          status IN ('pending', 'running', 'completed', 'failed')
        ),
        CONSTRAINT rollup_executions_scan_ids_check CHECK (
          array_length(scan_ids, 1) >= 1
        )
      );

      -- Indexes for rollup_executions
      CREATE INDEX IF NOT EXISTS idx_rollup_executions_rollup_id ON rollup_executions(rollup_id);
      CREATE INDEX IF NOT EXISTS idx_rollup_executions_tenant_id ON rollup_executions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_rollup_executions_status ON rollup_executions(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_rollup_executions_created_at ON rollup_executions(rollup_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_rollup_executions_scan_ids ON rollup_executions USING GIN (scan_ids);

      COMMENT ON TABLE rollup_executions IS 'Execution records for rollup aggregation jobs';
      COMMENT ON COLUMN rollup_executions.stats IS 'Execution statistics (nodes matched, edges created, etc.)';
      COMMENT ON COLUMN rollup_executions.matches IS 'Array of match results (may be large, consider external storage)';
    `);

    // ========================================================================
    // 3. Create rollup_matches table
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS rollup_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rollup_id UUID NOT NULL REFERENCES rollups(id) ON DELETE CASCADE,
        execution_id UUID NOT NULL REFERENCES rollup_executions(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        source_node_id VARCHAR(255) NOT NULL,
        target_node_id VARCHAR(255) NOT NULL,
        source_repo_id UUID NOT NULL,
        target_repo_id UUID NOT NULL,
        strategy VARCHAR(20) NOT NULL,
        confidence INTEGER NOT NULL,
        matched_attribute VARCHAR(255) NOT NULL,
        source_value TEXT NOT NULL,
        target_value TEXT NOT NULL,
        context JSONB,
        merged_node_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT rollup_matches_strategy_check CHECK (
          strategy IN ('arn', 'resource_id', 'name', 'tag')
        ),
        CONSTRAINT rollup_matches_confidence_check CHECK (
          confidence >= 0 AND confidence <= 100
        ),
        CONSTRAINT rollup_matches_different_repos CHECK (
          source_repo_id <> target_repo_id
        )
      );

      -- Indexes for rollup_matches
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_execution_id ON rollup_matches(execution_id);
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_tenant_id ON rollup_matches(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_strategy ON rollup_matches(execution_id, strategy);
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_confidence ON rollup_matches(execution_id, confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_source_node ON rollup_matches(execution_id, source_node_id);
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_target_node ON rollup_matches(execution_id, target_node_id);
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_merged_node ON rollup_matches(merged_node_id)
        WHERE merged_node_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_rollup_matches_repos ON rollup_matches(execution_id, source_repo_id, target_repo_id);

      COMMENT ON TABLE rollup_matches IS 'Match results between nodes from different repositories';
      COMMENT ON COLUMN rollup_matches.strategy IS 'Matching strategy used (arn, resource_id, name, tag)';
      COMMENT ON COLUMN rollup_matches.confidence IS 'Match confidence score 0-100';
      COMMENT ON COLUMN rollup_matches.merged_node_id IS 'Reference to resulting merged node';
    `);

    // ========================================================================
    // 4. Create merged_nodes table
    // ========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS merged_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rollup_id UUID NOT NULL REFERENCES rollups(id) ON DELETE CASCADE,
        execution_id UUID NOT NULL REFERENCES rollup_executions(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        canonical_name VARCHAR(500) NOT NULL,
        node_type VARCHAR(100) NOT NULL,
        source_node_ids TEXT[] NOT NULL,
        source_repo_ids UUID[] NOT NULL,
        locations JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        match_strategy VARCHAR(20) NOT NULL,
        match_confidence INTEGER NOT NULL,
        match_count INTEGER NOT NULL DEFAULT 1,
        source_count INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Constraints
        CONSTRAINT merged_nodes_unique_per_execution UNIQUE (rollup_id, execution_id, canonical_name, node_type),
        CONSTRAINT merged_nodes_strategy_check CHECK (
          match_strategy IN ('arn', 'resource_id', 'name', 'tag')
        ),
        CONSTRAINT merged_nodes_confidence_check CHECK (
          match_confidence >= 0 AND match_confidence <= 100
        ),
        CONSTRAINT merged_nodes_source_count_check CHECK (
          source_count >= 1 AND source_count = array_length(source_node_ids, 1)
        )
      );

      -- Indexes for merged_nodes
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_execution_id ON merged_nodes(execution_id);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_tenant_id ON merged_nodes(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_rollup_id ON merged_nodes(rollup_id);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_type ON merged_nodes(execution_id, node_type);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_canonical ON merged_nodes(rollup_id, canonical_name, node_type);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_confidence ON merged_nodes(execution_id, match_confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_source_nodes ON merged_nodes USING GIN (source_node_ids);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_source_repos ON merged_nodes USING GIN (source_repo_ids);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_strategy ON merged_nodes(execution_id, match_strategy);

      COMMENT ON TABLE merged_nodes IS 'Aggregated nodes resulting from cross-repository matching';
      COMMENT ON COLUMN merged_nodes.canonical_name IS 'Unified name for the merged resource';
      COMMENT ON COLUMN merged_nodes.source_node_ids IS 'Array of original node IDs that were merged';
      COMMENT ON COLUMN merged_nodes.source_repo_ids IS 'Array of repository IDs containing source nodes';
      COMMENT ON COLUMN merged_nodes.locations IS 'JSON array of file locations from all source repos';
    `);

    // ========================================================================
    // 5. Enable Row-Level Security (RLS)
    // ========================================================================
    await client.query(`
      -- Enable RLS on all rollup tables
      ALTER TABLE rollups ENABLE ROW LEVEL SECURITY;
      ALTER TABLE rollup_executions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE rollup_matches ENABLE ROW LEVEL SECURITY;
      ALTER TABLE merged_nodes ENABLE ROW LEVEL SECURITY;

      -- RLS policies for rollups
      DROP POLICY IF EXISTS rollups_tenant_isolation ON rollups;
      CREATE POLICY rollups_tenant_isolation ON rollups
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

      -- RLS policies for rollup_executions
      DROP POLICY IF EXISTS rollup_executions_tenant_isolation ON rollup_executions;
      CREATE POLICY rollup_executions_tenant_isolation ON rollup_executions
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

      -- RLS policies for rollup_matches
      DROP POLICY IF EXISTS rollup_matches_tenant_isolation ON rollup_matches;
      CREATE POLICY rollup_matches_tenant_isolation ON rollup_matches
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

      -- RLS policies for merged_nodes
      DROP POLICY IF EXISTS merged_nodes_tenant_isolation ON merged_nodes;
      CREATE POLICY merged_nodes_tenant_isolation ON merged_nodes
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
    `);

    // ========================================================================
    // 6. Create helper functions
    // ========================================================================
    await client.query(`
      -- Function to get rollup execution summary
      CREATE OR REPLACE FUNCTION get_rollup_execution_summary(p_execution_id UUID)
      RETURNS TABLE (
        total_matches BIGINT,
        matches_by_strategy JSONB,
        merged_node_count BIGINT,
        avg_confidence NUMERIC
      )
      LANGUAGE plpgsql
      STABLE
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          (SELECT COUNT(*) FROM rollup_matches WHERE execution_id = p_execution_id) AS total_matches,
          (
            SELECT COALESCE(
              jsonb_object_agg(strategy, cnt),
              '{}'::jsonb
            )
            FROM (
              SELECT strategy, COUNT(*) AS cnt
              FROM rollup_matches
              WHERE execution_id = p_execution_id
              GROUP BY strategy
            ) s
          ) AS matches_by_strategy,
          (SELECT COUNT(*) FROM merged_nodes WHERE execution_id = p_execution_id) AS merged_node_count,
          (SELECT AVG(match_confidence)::numeric(5,2) FROM merged_nodes WHERE execution_id = p_execution_id) AS avg_confidence;
      END;
      $$;

      COMMENT ON FUNCTION get_rollup_execution_summary IS 'Returns summary statistics for a rollup execution';
    `);
  },

  /**
   * Rollback migration - drop rollup tables
   */
  async down(client: pg.PoolClient): Promise<void> {
    // Drop in reverse order due to foreign key constraints

    // Drop helper functions
    await client.query(`
      DROP FUNCTION IF EXISTS get_rollup_execution_summary(UUID);
    `);

    // Disable RLS and drop policies
    await client.query(`
      DROP POLICY IF EXISTS merged_nodes_tenant_isolation ON merged_nodes;
      DROP POLICY IF EXISTS rollup_matches_tenant_isolation ON rollup_matches;
      DROP POLICY IF EXISTS rollup_executions_tenant_isolation ON rollup_executions;
      DROP POLICY IF EXISTS rollups_tenant_isolation ON rollups;
    `);

    // Drop tables in reverse dependency order
    await client.query(`DROP TABLE IF EXISTS merged_nodes CASCADE`);
    await client.query(`DROP TABLE IF EXISTS rollup_matches CASCADE`);
    await client.query(`DROP TABLE IF EXISTS rollup_executions CASCADE`);
    await client.query(`DROP TABLE IF EXISTS rollups CASCADE`);
  },
};

// ============================================================================
// Migration Runner Utility
// ============================================================================

/**
 * Run this migration directly
 */
export async function runMigration(client: pg.PoolClient, direction: 'up' | 'down'): Promise<void> {
  if (direction === 'up') {
    await migration.up(client);
  } else {
    await migration.down(client);
  }
}

export default migration;
