-- =============================================================================
-- Migration 011: Terragrunt Config Node Type
-- TASK-TG-007: Add tg_config to node_type enum for TerragruntConfigNode support
-- =============================================================================

-- =============================================================================
-- Add 'tg_config' to node_type enum
-- =============================================================================

-- PostgreSQL requires a transaction to add enum values safely
-- Check if 'tg_config' already exists before adding

DO $$
BEGIN
    -- Check if the value already exists in the enum
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'tg_config'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'node_type')
    ) THEN
        -- Add the new enum value
        ALTER TYPE node_type ADD VALUE 'tg_config';
    END IF;
END
$$;

-- =============================================================================
-- Performance Indexes for Terragrunt Config Nodes
-- Optimized for common query patterns in Terragrunt analysis
-- =============================================================================

-- Index 1: Terragrunt config nodes by scan
-- Optimizes queries filtering nodes by scan_id where type is tg_config
CREATE INDEX IF NOT EXISTS idx_nodes_tg_config_scan
ON nodes(scan_id)
WHERE type = 'tg_config';

-- Index 2: GIN index for JSONB metadata queries on terragrunt nodes
-- Optimizes queries that search within metadata (e.g., terraformSource, remoteStateBackend)
CREATE INDEX IF NOT EXISTS idx_nodes_tg_config_metadata
ON nodes USING gin (metadata jsonb_path_ops)
WHERE type = 'tg_config';

-- Index 3: Terragrunt nodes by file_path for directory-based queries
-- Useful for finding all terragrunt configs in a specific directory tree
CREATE INDEX IF NOT EXISTS idx_nodes_tg_config_file_path
ON nodes(scan_id, file_path)
WHERE type = 'tg_config';

-- =============================================================================
-- Index Comments
-- =============================================================================

COMMENT ON INDEX idx_nodes_tg_config_scan IS
    'Optimizes queries for Terragrunt config nodes filtered by scan';

COMMENT ON INDEX idx_nodes_tg_config_metadata IS
    'Enables efficient JSONB metadata searches on Terragrunt config nodes';

COMMENT ON INDEX idx_nodes_tg_config_file_path IS
    'Optimizes directory-based queries for Terragrunt configurations';

-- =============================================================================
-- Helper Functions for Terragrunt Config Node Queries
-- =============================================================================

-- Function: Get Terragrunt config nodes for a scan with metadata expansion
CREATE OR REPLACE FUNCTION get_terragrunt_config_nodes(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR(500),
    file_path VARCHAR(1000),
    terraform_source TEXT,
    has_remote_state BOOLEAN,
    remote_state_backend TEXT,
    include_count INTEGER,
    dependency_count INTEGER,
    input_count INTEGER,
    generate_blocks JSONB,
    line_start INTEGER,
    line_end INTEGER,
    created_at TIMESTAMPTZ,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id AS node_id,
        n.name AS node_name,
        n.file_path,
        (n.metadata->>'terraformSource')::TEXT AS terraform_source,
        COALESCE((n.metadata->>'hasRemoteState')::BOOLEAN, false) AS has_remote_state,
        (n.metadata->>'remoteStateBackend')::TEXT AS remote_state_backend,
        COALESCE((n.metadata->>'includeCount')::INTEGER, 0) AS include_count,
        COALESCE((n.metadata->>'dependencyCount')::INTEGER, 0) AS dependency_count,
        COALESCE((n.metadata->>'inputCount')::INTEGER, 0) AS input_count,
        COALESCE(n.metadata->'generateBlocks', '[]'::jsonb) AS generate_blocks,
        n.line_start,
        n.line_end,
        n.created_at,
        COUNT(*) OVER() AS total_count
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'tg_config'
    ORDER BY n.file_path, n.line_start
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_terragrunt_config_nodes IS
    'Retrieves Terragrunt config nodes with expanded metadata for a scan';

-- Function: Get Terragrunt config statistics for a scan
CREATE OR REPLACE FUNCTION get_terragrunt_config_stats(
    p_tenant_id UUID,
    p_scan_id UUID
)
RETURNS TABLE (
    total_configs BIGINT,
    with_remote_state BIGINT,
    with_terraform_source BIGINT,
    total_dependencies BIGINT,
    total_includes BIGINT,
    total_inputs BIGINT,
    unique_backends BIGINT,
    backend_distribution JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_configs,
        COUNT(*) FILTER (
            WHERE COALESCE((n.metadata->>'hasRemoteState')::BOOLEAN, false) = true
        )::BIGINT AS with_remote_state,
        COUNT(*) FILTER (
            WHERE n.metadata->>'terraformSource' IS NOT NULL
        )::BIGINT AS with_terraform_source,
        COALESCE(SUM((n.metadata->>'dependencyCount')::INTEGER), 0)::BIGINT AS total_dependencies,
        COALESCE(SUM((n.metadata->>'includeCount')::INTEGER), 0)::BIGINT AS total_includes,
        COALESCE(SUM((n.metadata->>'inputCount')::INTEGER), 0)::BIGINT AS total_inputs,
        COUNT(DISTINCT n.metadata->>'remoteStateBackend')::BIGINT AS unique_backends,
        COALESCE(
            jsonb_object_agg(
                COALESCE(n.metadata->>'remoteStateBackend', 'none'),
                1
            ) FILTER (WHERE n.metadata->>'remoteStateBackend' IS NOT NULL),
            '{}'::jsonb
        ) AS backend_distribution
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'tg_config';
END;
$$;

COMMENT ON FUNCTION get_terragrunt_config_stats IS
    'Returns aggregate statistics for Terragrunt config nodes in a scan';

-- Function: Find Terragrunt configs by remote state backend
CREATE OR REPLACE FUNCTION find_terragrunt_configs_by_backend(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_backend_type VARCHAR(50)
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR(500),
    file_path VARCHAR(1000),
    remote_state_backend TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id AS node_id,
        n.name AS node_name,
        n.file_path,
        (n.metadata->>'remoteStateBackend')::TEXT AS remote_state_backend
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'tg_config'
      AND n.metadata->>'remoteStateBackend' = p_backend_type
    ORDER BY n.file_path;
END;
$$;

COMMENT ON FUNCTION find_terragrunt_configs_by_backend IS
    'Finds Terragrunt config nodes by remote state backend type (s3, gcs, azurerm, etc.)';

-- Function: Find Terragrunt configs with dependencies
CREATE OR REPLACE FUNCTION find_terragrunt_configs_with_dependencies(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_min_dependency_count INTEGER DEFAULT 1
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR(500),
    file_path VARCHAR(1000),
    dependency_count INTEGER,
    dependency_names JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id AS node_id,
        n.name AS node_name,
        n.file_path,
        COALESCE((n.metadata->>'dependencyCount')::INTEGER, 0) AS dependency_count,
        COALESCE(n.metadata->'dependencyNames', '[]'::jsonb) AS dependency_names
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'tg_config'
      AND COALESCE((n.metadata->>'dependencyCount')::INTEGER, 0) >= p_min_dependency_count
    ORDER BY (n.metadata->>'dependencyCount')::INTEGER DESC, n.file_path;
END;
$$;

COMMENT ON FUNCTION find_terragrunt_configs_with_dependencies IS
    'Finds Terragrunt config nodes that have dependencies on other configs';

-- =============================================================================
-- Migration Tracking
-- =============================================================================

INSERT INTO schema_migrations (version)
VALUES ('011_terragrunt_config_node_type')
ON CONFLICT (version) DO NOTHING;
