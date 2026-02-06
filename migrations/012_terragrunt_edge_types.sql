-- =============================================================================
-- Migration 012: Terragrunt Edge Types
-- TASK-TG-008: Add 4 edge types to edge_type enum for Terragrunt relationship support
-- =============================================================================
--
-- Edge Types Added:
--   tg_includes     - Include block: child config -> parent config
--   tg_depends_on   - Dependency block: config -> dependency config
--   tg_passes_input - Input flow: parent config -> child config
--   tg_sources      - TF source: TG config -> TF module
--
-- Indexes Added:
--   idx_edges_tg_includes_scan       - Optimizes tg_includes queries by scan
--   idx_edges_tg_depends_on_scan     - Optimizes tg_depends_on queries by scan
--   idx_edges_tg_passes_input_scan   - Optimizes tg_passes_input queries by scan
--   idx_edges_tg_sources_scan        - Optimizes tg_sources queries by scan
--   idx_edges_tg_all_evidence        - GIN index for JSONB evidence queries on TG edges
--
-- Helper Functions Added:
--   get_terragrunt_edges()                    - Get all TG edges for a scan
--   get_terragrunt_include_hierarchy()        - Get include hierarchy tree
--   get_terragrunt_dependency_graph()         - Get dependency DAG for analysis
--   find_terragrunt_edges_by_confidence()     - Find edges filtered by confidence
--
-- =============================================================================

-- =============================================================================
-- Add 'tg_includes' to edge_type enum
-- Represents include block relationships: child config -> parent config
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'tg_includes'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'tg_includes';
    END IF;
END
$$;

-- =============================================================================
-- Add 'tg_depends_on' to edge_type enum
-- Represents dependency block relationships: config -> dependency config
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'tg_depends_on'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'tg_depends_on';
    END IF;
END
$$;

-- =============================================================================
-- Add 'tg_passes_input' to edge_type enum
-- Represents input flow from parent to child via exposed includes
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'tg_passes_input'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'tg_passes_input';
    END IF;
END
$$;

-- =============================================================================
-- Add 'tg_sources' to edge_type enum
-- Represents Terragrunt config sourcing a Terraform module
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'tg_sources'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'tg_sources';
    END IF;
END
$$;

-- =============================================================================
-- Performance Indexes for Terragrunt Edge Queries
-- =============================================================================

-- Index 1: Terragrunt include edges by scan
-- Optimizes queries for include hierarchy analysis
CREATE INDEX IF NOT EXISTS idx_edges_tg_includes_scan
ON edges(scan_id, source_node_id, target_node_id)
WHERE type = 'tg_includes';

-- Index 2: Terragrunt dependency edges by scan
-- Optimizes queries for dependency graph traversal
CREATE INDEX IF NOT EXISTS idx_edges_tg_depends_on_scan
ON edges(scan_id, source_node_id, target_node_id)
WHERE type = 'tg_depends_on';

-- Index 3: Terragrunt input passing edges by scan
-- Optimizes queries for input flow analysis
CREATE INDEX IF NOT EXISTS idx_edges_tg_passes_input_scan
ON edges(scan_id, source_node_id, target_node_id)
WHERE type = 'tg_passes_input';

-- Index 4: Terragrunt source edges by scan
-- Optimizes queries for Terraform module resolution
CREATE INDEX IF NOT EXISTS idx_edges_tg_sources_scan
ON edges(scan_id, source_node_id, target_node_id)
WHERE type = 'tg_sources';

-- Index 5: GIN index for JSONB evidence queries on Terragrunt edges
-- Enables efficient searches within edge evidence metadata
CREATE INDEX IF NOT EXISTS idx_edges_tg_all_evidence
ON edges USING gin (evidence jsonb_path_ops)
WHERE type IN ('tg_includes', 'tg_depends_on', 'tg_passes_input', 'tg_sources');

-- =============================================================================
-- Index Comments
-- =============================================================================

COMMENT ON INDEX idx_edges_tg_includes_scan IS
    'Optimizes queries for Terragrunt include relationship traversal';

COMMENT ON INDEX idx_edges_tg_depends_on_scan IS
    'Optimizes queries for Terragrunt dependency graph analysis';

COMMENT ON INDEX idx_edges_tg_passes_input_scan IS
    'Optimizes queries for Terragrunt input flow tracking';

COMMENT ON INDEX idx_edges_tg_sources_scan IS
    'Optimizes queries for Terragrunt-to-Terraform module resolution';

COMMENT ON INDEX idx_edges_tg_all_evidence IS
    'Enables efficient JSONB evidence searches on Terragrunt edges';

-- =============================================================================
-- Helper Functions for Terragrunt Edge Queries
-- =============================================================================

-- Function 1: Get all Terragrunt edges for a scan with metadata expansion
CREATE OR REPLACE FUNCTION get_terragrunt_edges(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_edge_type VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    edge_id UUID,
    edge_type edge_type,
    source_node_id UUID,
    source_node_name VARCHAR(500),
    source_file_path VARCHAR(1000),
    target_node_id UUID,
    target_node_name VARCHAR(500),
    target_file_path VARCHAR(1000),
    confidence DECIMAL(3,2),
    evidence JSONB,
    created_at TIMESTAMPTZ,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.type AS edge_type,
        e.source_node_id,
        src.name AS source_node_name,
        src.file_path AS source_file_path,
        e.target_node_id,
        tgt.name AS target_node_name,
        tgt.file_path AS target_file_path,
        e.confidence,
        e.evidence,
        e.created_at,
        COUNT(*) OVER() AS total_count
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE e.scan_id = p_scan_id
      AND e.type IN ('tg_includes', 'tg_depends_on', 'tg_passes_input', 'tg_sources')
      AND (p_edge_type IS NULL OR e.type::TEXT = p_edge_type)
    ORDER BY e.type, src.file_path, tgt.file_path
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_terragrunt_edges IS
    'Retrieves all Terragrunt edges for a scan with joined node information';

-- Function 2: Get Terragrunt include hierarchy (recursive traversal)
-- Returns the include hierarchy tree for configs in a scan
CREATE OR REPLACE FUNCTION get_terragrunt_include_hierarchy(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_root_node_id UUID DEFAULT NULL
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR(500),
    file_path VARCHAR(1000),
    parent_node_id UUID,
    parent_name VARCHAR(500),
    parent_file_path VARCHAR(1000),
    include_label TEXT,
    merge_strategy TEXT,
    depth INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE include_tree AS (
        -- Base case: root nodes (no incoming tg_includes edges)
        SELECT
            n.id AS node_id,
            n.name AS node_name,
            n.file_path,
            NULL::UUID AS parent_node_id,
            NULL::VARCHAR(500) AS parent_name,
            NULL::VARCHAR(1000) AS parent_file_path,
            NULL::TEXT AS include_label,
            NULL::TEXT AS merge_strategy,
            0 AS depth
        FROM nodes n
        WHERE n.scan_id = p_scan_id
          AND n.type = 'tg_config'
          AND (p_root_node_id IS NULL OR n.id = p_root_node_id)
          AND NOT EXISTS (
              SELECT 1 FROM edges e
              WHERE e.source_node_id = n.id
                AND e.type = 'tg_includes'
                AND e.scan_id = p_scan_id
          )

        UNION ALL

        -- Recursive case: nodes that include the current node
        SELECT
            child.id AS node_id,
            child.name AS node_name,
            child.file_path,
            parent.node_id AS parent_node_id,
            parent.node_name AS parent_name,
            parent.file_path AS parent_file_path,
            COALESCE(e.evidence->>'includeName', 'default')::TEXT AS include_label,
            COALESCE(e.evidence->>'mergeStrategy', 'shallow')::TEXT AS merge_strategy,
            parent.depth + 1 AS depth
        FROM include_tree parent
        JOIN edges e ON e.target_node_id = parent.node_id
            AND e.type = 'tg_includes'
            AND e.scan_id = p_scan_id
        JOIN nodes child ON e.source_node_id = child.id
        WHERE parent.depth < 10  -- Prevent infinite recursion
    )
    SELECT
        it.node_id,
        it.node_name,
        it.file_path,
        it.parent_node_id,
        it.parent_name,
        it.parent_file_path,
        it.include_label,
        it.merge_strategy,
        it.depth
    FROM include_tree it
    ORDER BY it.depth, it.file_path;
END;
$$;

COMMENT ON FUNCTION get_terragrunt_include_hierarchy IS
    'Returns the include hierarchy tree showing parent-child config relationships';

-- Function 3: Get Terragrunt dependency graph (DAG analysis)
-- Returns dependency relationships for impact analysis
CREATE OR REPLACE FUNCTION get_terragrunt_dependency_graph(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_start_node_id UUID DEFAULT NULL,
    p_direction VARCHAR(10) DEFAULT 'downstream'
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR(500),
    file_path VARCHAR(1000),
    dependency_name TEXT,
    depends_on_node_id UUID,
    depends_on_name VARCHAR(500),
    depends_on_file_path VARCHAR(1000),
    skip_outputs BOOLEAN,
    has_mock_outputs BOOLEAN,
    hop_distance INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_direction = 'upstream' THEN
        -- Find what this node depends on (upstream)
        RETURN QUERY
        WITH RECURSIVE dep_chain AS (
            -- Base case: direct dependencies
            SELECT
                e.source_node_id AS node_id,
                src.name AS node_name,
                src.file_path,
                COALESCE(e.evidence->>'dependencyName', 'unknown')::TEXT AS dependency_name,
                e.target_node_id AS depends_on_node_id,
                tgt.name AS depends_on_name,
                tgt.file_path AS depends_on_file_path,
                COALESCE((e.evidence->>'skipOutputs')::BOOLEAN, false) AS skip_outputs,
                COALESCE((e.evidence->>'hasMockOutputs')::BOOLEAN, false) AS has_mock_outputs,
                1 AS hop_distance
            FROM edges e
            JOIN nodes src ON e.source_node_id = src.id
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE e.scan_id = p_scan_id
              AND e.type = 'tg_depends_on'
              AND (p_start_node_id IS NULL OR e.source_node_id = p_start_node_id)

            UNION ALL

            -- Recursive: dependencies of dependencies
            SELECT
                e.source_node_id AS node_id,
                src.name AS node_name,
                src.file_path,
                COALESCE(e.evidence->>'dependencyName', 'unknown')::TEXT AS dependency_name,
                e.target_node_id AS depends_on_node_id,
                tgt.name AS depends_on_name,
                tgt.file_path AS depends_on_file_path,
                COALESCE((e.evidence->>'skipOutputs')::BOOLEAN, false) AS skip_outputs,
                COALESCE((e.evidence->>'hasMockOutputs')::BOOLEAN, false) AS has_mock_outputs,
                dc.hop_distance + 1 AS hop_distance
            FROM dep_chain dc
            JOIN edges e ON e.source_node_id = dc.depends_on_node_id
                AND e.type = 'tg_depends_on'
                AND e.scan_id = p_scan_id
            JOIN nodes src ON e.source_node_id = src.id
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE dc.hop_distance < 20  -- Prevent infinite recursion
        )
        SELECT * FROM dep_chain ORDER BY hop_distance, file_path;
    ELSE
        -- Find what depends on this node (downstream)
        RETURN QUERY
        WITH RECURSIVE dep_chain AS (
            -- Base case: nodes that depend on the start node
            SELECT
                e.source_node_id AS node_id,
                src.name AS node_name,
                src.file_path,
                COALESCE(e.evidence->>'dependencyName', 'unknown')::TEXT AS dependency_name,
                e.target_node_id AS depends_on_node_id,
                tgt.name AS depends_on_name,
                tgt.file_path AS depends_on_file_path,
                COALESCE((e.evidence->>'skipOutputs')::BOOLEAN, false) AS skip_outputs,
                COALESCE((e.evidence->>'hasMockOutputs')::BOOLEAN, false) AS has_mock_outputs,
                1 AS hop_distance
            FROM edges e
            JOIN nodes src ON e.source_node_id = src.id
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE e.scan_id = p_scan_id
              AND e.type = 'tg_depends_on'
              AND (p_start_node_id IS NULL OR e.target_node_id = p_start_node_id)

            UNION ALL

            -- Recursive: nodes that depend on the dependents
            SELECT
                e.source_node_id AS node_id,
                src.name AS node_name,
                src.file_path,
                COALESCE(e.evidence->>'dependencyName', 'unknown')::TEXT AS dependency_name,
                e.target_node_id AS depends_on_node_id,
                tgt.name AS depends_on_name,
                tgt.file_path AS depends_on_file_path,
                COALESCE((e.evidence->>'skipOutputs')::BOOLEAN, false) AS skip_outputs,
                COALESCE((e.evidence->>'hasMockOutputs')::BOOLEAN, false) AS has_mock_outputs,
                dc.hop_distance + 1 AS hop_distance
            FROM dep_chain dc
            JOIN edges e ON e.target_node_id = dc.node_id
                AND e.type = 'tg_depends_on'
                AND e.scan_id = p_scan_id
            JOIN nodes src ON e.source_node_id = src.id
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE dc.hop_distance < 20  -- Prevent infinite recursion
        )
        SELECT * FROM dep_chain ORDER BY hop_distance, file_path;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_terragrunt_dependency_graph IS
    'Returns upstream or downstream Terragrunt dependencies for impact analysis';

-- Function 4: Find Terragrunt edges by confidence threshold
-- Useful for identifying uncertain edges that may need review
CREATE OR REPLACE FUNCTION find_terragrunt_edges_by_confidence(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_min_confidence DECIMAL(3,2) DEFAULT 0.00,
    p_max_confidence DECIMAL(3,2) DEFAULT 1.00
)
RETURNS TABLE (
    edge_id UUID,
    edge_type edge_type,
    source_node_id UUID,
    source_node_name VARCHAR(500),
    source_file_path VARCHAR(1000),
    target_node_id UUID,
    target_node_name VARCHAR(500),
    target_file_path VARCHAR(1000),
    confidence DECIMAL(3,2),
    evidence_type TEXT,
    evidence_description TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.type AS edge_type,
        e.source_node_id,
        src.name AS source_node_name,
        src.file_path AS source_file_path,
        e.target_node_id,
        tgt.name AS target_node_name,
        tgt.file_path AS target_file_path,
        e.confidence,
        COALESCE(e.evidence->>'type', 'unknown')::TEXT AS evidence_type,
        COALESCE(e.evidence->>'description', '')::TEXT AS evidence_description
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE e.scan_id = p_scan_id
      AND e.type IN ('tg_includes', 'tg_depends_on', 'tg_passes_input', 'tg_sources')
      AND e.confidence >= p_min_confidence
      AND e.confidence <= p_max_confidence
    ORDER BY e.confidence ASC, e.type, src.file_path;
END;
$$;

COMMENT ON FUNCTION find_terragrunt_edges_by_confidence IS
    'Finds Terragrunt edges filtered by confidence threshold for review';

-- =============================================================================
-- Aggregate Statistics Function
-- =============================================================================

-- Function 5: Get Terragrunt edge statistics for a scan
CREATE OR REPLACE FUNCTION get_terragrunt_edge_stats(
    p_tenant_id UUID,
    p_scan_id UUID
)
RETURNS TABLE (
    total_tg_edges BIGINT,
    includes_count BIGINT,
    depends_on_count BIGINT,
    passes_input_count BIGINT,
    sources_count BIGINT,
    avg_confidence DECIMAL(5,2),
    low_confidence_count BIGINT,
    high_confidence_count BIGINT,
    unique_source_nodes BIGINT,
    unique_target_nodes BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_tg_edges,
        COUNT(*) FILTER (WHERE e.type = 'tg_includes')::BIGINT AS includes_count,
        COUNT(*) FILTER (WHERE e.type = 'tg_depends_on')::BIGINT AS depends_on_count,
        COUNT(*) FILTER (WHERE e.type = 'tg_passes_input')::BIGINT AS passes_input_count,
        COUNT(*) FILTER (WHERE e.type = 'tg_sources')::BIGINT AS sources_count,
        COALESCE(AVG(e.confidence), 0)::DECIMAL(5,2) AS avg_confidence,
        COUNT(*) FILTER (WHERE e.confidence < 0.70)::BIGINT AS low_confidence_count,
        COUNT(*) FILTER (WHERE e.confidence >= 0.90)::BIGINT AS high_confidence_count,
        COUNT(DISTINCT e.source_node_id)::BIGINT AS unique_source_nodes,
        COUNT(DISTINCT e.target_node_id)::BIGINT AS unique_target_nodes
    FROM edges e
    WHERE e.scan_id = p_scan_id
      AND e.type IN ('tg_includes', 'tg_depends_on', 'tg_passes_input', 'tg_sources');
END;
$$;

COMMENT ON FUNCTION get_terragrunt_edge_stats IS
    'Returns aggregate statistics for Terragrunt edges in a scan';

-- =============================================================================
-- Migration Tracking
-- =============================================================================

INSERT INTO schema_migrations (version)
VALUES ('012_terragrunt_edge_types')
ON CONFLICT (version) DO NOTHING;
