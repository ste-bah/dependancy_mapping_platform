-- =============================================================================
-- Migration 013: FEEDS_INTO Edge Type for TF-Helm Data Flow
-- TASK-XREF-006: Add FEEDS_INTO edge type to track data flow between Terraform and Helm
-- =============================================================================
--
-- Edge Type Added:
--   FEEDS_INTO - Data flow from Terraform/Terragrunt outputs to Helm/K8s values
--
-- Columns Added:
--   flow_mechanism      - How data flows (ci_pipeline, direct_reference, state_query)
--   pipeline_type       - CI/CD pipeline type (github_actions, gitlab_ci, jenkins, etc.)
--   transformation_type - Data transformation (jq, yq, envsubst, direct, etc.)
--   first_detected      - When the flow was first detected
--   last_verified       - When the flow was last verified
--
-- Indexes Added:
--   idx_edges_feeds_into_target   - Optimizes reverse lookups (find sources for a target)
--   idx_edges_feeds_into_source   - Optimizes forward lookups (find targets for a source)
--   idx_edges_feeds_into_metadata - GIN index for JSONB metadata queries
--   idx_edges_feeds_into_scan     - Index for scan-based queries
--   idx_edges_feeds_into_confidence - Index for confidence-based queries
--
-- Helper Functions Added:
--   get_feeds_into_edges()           - Get all FEEDS_INTO edges for a scan
--   get_terraform_inputs_for_helm()  - Find TF outputs feeding into a Helm chart
--   get_helm_consumers_for_tf()      - Find Helm charts consuming a TF output
--   get_data_flow_chain()            - Trace complete data flow chains
--   get_feeds_into_stats()           - Aggregate statistics for FEEDS_INTO edges
--
-- =============================================================================

-- =============================================================================
-- Add 'FEEDS_INTO' to edge_type enum
-- Represents data flow from Terraform/Terragrunt outputs to Helm values
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'FEEDS_INTO'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'FEEDS_INTO';
    END IF;
END
$$;

-- =============================================================================
-- Add Columns for Cross-Tool Edge Metadata
-- =============================================================================

-- Flow mechanism: how data flows between source and target
ALTER TABLE edges ADD COLUMN IF NOT EXISTS flow_mechanism VARCHAR(50);
COMMENT ON COLUMN edges.flow_mechanism IS 'Mechanism for data flow (ci_pipeline, direct_reference, state_query)';

-- Pipeline type: CI/CD system where flow was detected
ALTER TABLE edges ADD COLUMN IF NOT EXISTS pipeline_type VARCHAR(50);
COMMENT ON COLUMN edges.pipeline_type IS 'CI/CD pipeline type (github_actions, gitlab_ci, jenkins, azure_devops)';

-- Transformation type: how data is transformed during flow
ALTER TABLE edges ADD COLUMN IF NOT EXISTS transformation_type VARCHAR(50);
COMMENT ON COLUMN edges.transformation_type IS 'Transformation applied to data (jq, yq, envsubst, direct, sed, awk, custom)';

-- First detected: when the flow was initially discovered
ALTER TABLE edges ADD COLUMN IF NOT EXISTS first_detected TIMESTAMPTZ;
COMMENT ON COLUMN edges.first_detected IS 'Timestamp when this data flow was first detected';

-- Last verified: when the flow was last confirmed
ALTER TABLE edges ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;
COMMENT ON COLUMN edges.last_verified IS 'Timestamp when this data flow was last verified';

-- =============================================================================
-- Performance Indexes for FEEDS_INTO Edge Queries
-- =============================================================================

-- Index 1: Reverse lookup - find sources feeding into a target
-- Optimizes queries like "what TF outputs feed into this Helm chart?"
CREATE INDEX IF NOT EXISTS idx_edges_feeds_into_target
ON edges (target_node_id, scan_id)
WHERE type = 'FEEDS_INTO';

-- Index 2: Forward lookup - find targets consuming from a source
-- Optimizes queries like "what Helm charts consume this TF output?"
CREATE INDEX IF NOT EXISTS idx_edges_feeds_into_source
ON edges (source_node_id, scan_id)
WHERE type = 'FEEDS_INTO';

-- Index 3: GIN index for JSONB metadata queries
-- Enables efficient searches within edge metadata (source type, target path, etc.)
CREATE INDEX IF NOT EXISTS idx_edges_feeds_into_metadata
ON edges USING gin (metadata jsonb_path_ops)
WHERE type = 'FEEDS_INTO';

-- Index 4: Scan-based queries with confidence ordering
-- Optimizes fetching all FEEDS_INTO edges for a scan sorted by confidence
CREATE INDEX IF NOT EXISTS idx_edges_feeds_into_scan
ON edges (scan_id, confidence DESC)
WHERE type = 'FEEDS_INTO';

-- Index 5: Confidence-based queries
-- Optimizes queries filtering by confidence threshold
CREATE INDEX IF NOT EXISTS idx_edges_feeds_into_confidence
ON edges (confidence DESC)
WHERE type = 'FEEDS_INTO';

-- Index 6: Pipeline type queries
-- Optimizes queries filtering by pipeline type
CREATE INDEX IF NOT EXISTS idx_edges_feeds_into_pipeline
ON edges (pipeline_type, scan_id)
WHERE type = 'FEEDS_INTO' AND pipeline_type IS NOT NULL;

-- Index 7: Flow mechanism queries
-- Optimizes queries filtering by flow mechanism
CREATE INDEX IF NOT EXISTS idx_edges_feeds_into_mechanism
ON edges (flow_mechanism, scan_id)
WHERE type = 'FEEDS_INTO' AND flow_mechanism IS NOT NULL;

-- =============================================================================
-- Index Comments
-- =============================================================================

COMMENT ON INDEX idx_edges_feeds_into_target IS
    'Optimizes reverse lookups to find Terraform sources feeding into a Helm target';

COMMENT ON INDEX idx_edges_feeds_into_source IS
    'Optimizes forward lookups to find Helm targets consuming a Terraform source';

COMMENT ON INDEX idx_edges_feeds_into_metadata IS
    'Enables efficient JSONB queries on FEEDS_INTO edge metadata';

COMMENT ON INDEX idx_edges_feeds_into_scan IS
    'Optimizes scan-based queries for FEEDS_INTO edges with confidence ordering';

COMMENT ON INDEX idx_edges_feeds_into_confidence IS
    'Optimizes confidence-filtered queries for FEEDS_INTO edges';

COMMENT ON INDEX idx_edges_feeds_into_pipeline IS
    'Optimizes pipeline type filtering for FEEDS_INTO edges';

COMMENT ON INDEX idx_edges_feeds_into_mechanism IS
    'Optimizes flow mechanism filtering for FEEDS_INTO edges';

-- =============================================================================
-- Helper Functions for FEEDS_INTO Edge Queries
-- =============================================================================

-- Function 1: Get all FEEDS_INTO edges for a scan with metadata expansion
CREATE OR REPLACE FUNCTION get_feeds_into_edges(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_min_confidence DECIMAL(3,2) DEFAULT 0.00,
    p_pipeline_type VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    edge_id UUID,
    source_node_id UUID,
    source_node_name VARCHAR(500),
    source_file_path VARCHAR(1000),
    source_output_name TEXT,
    target_node_id UUID,
    target_node_name VARCHAR(500),
    target_file_path VARCHAR(1000),
    target_value_path TEXT,
    target_chart TEXT,
    flow_mechanism VARCHAR(50),
    pipeline_type VARCHAR(50),
    transformation_type VARCHAR(50),
    confidence DECIMAL(3,2),
    first_detected TIMESTAMPTZ,
    last_verified TIMESTAMPTZ,
    evidence JSONB,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.source_node_id,
        src.name AS source_node_name,
        src.file_path AS source_file_path,
        COALESCE(e.metadata->>'sourceOutputName', '')::TEXT AS source_output_name,
        e.target_node_id,
        tgt.name AS target_node_name,
        tgt.file_path AS target_file_path,
        COALESCE(e.metadata->>'targetValuePath', '')::TEXT AS target_value_path,
        COALESCE(e.metadata->>'targetChart', '')::TEXT AS target_chart,
        e.flow_mechanism,
        e.pipeline_type,
        e.transformation_type,
        e.confidence,
        e.first_detected,
        e.last_verified,
        e.evidence,
        COUNT(*) OVER() AS total_count
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'FEEDS_INTO'
      AND e.confidence >= p_min_confidence
      AND (p_pipeline_type IS NULL OR e.pipeline_type = p_pipeline_type)
    ORDER BY e.confidence DESC, src.file_path, tgt.file_path
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_feeds_into_edges IS
    'Retrieves all FEEDS_INTO edges for a scan with joined node information and filtering';

-- Function 2: Find Terraform outputs feeding into a specific Helm chart/node
CREATE OR REPLACE FUNCTION get_terraform_inputs_for_helm(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_helm_node_id UUID,
    p_min_confidence DECIMAL(3,2) DEFAULT 0.00
)
RETURNS TABLE (
    edge_id UUID,
    tf_node_id UUID,
    tf_node_name VARCHAR(500),
    tf_file_path VARCHAR(1000),
    tf_output_name TEXT,
    tf_module_path TEXT,
    target_value_path TEXT,
    flow_mechanism VARCHAR(50),
    transformation_type VARCHAR(50),
    confidence DECIMAL(3,2),
    evidence JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.source_node_id AS tf_node_id,
        src.name AS tf_node_name,
        src.file_path AS tf_file_path,
        COALESCE(e.metadata->>'sourceOutputName', '')::TEXT AS tf_output_name,
        COALESCE(e.metadata->>'sourceModulePath', '')::TEXT AS tf_module_path,
        COALESCE(e.metadata->>'targetValuePath', '')::TEXT AS target_value_path,
        e.flow_mechanism,
        e.transformation_type,
        e.confidence,
        e.evidence
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'FEEDS_INTO'
      AND e.target_node_id = p_helm_node_id
      AND e.confidence >= p_min_confidence
    ORDER BY e.confidence DESC, src.name;
END;
$$;

COMMENT ON FUNCTION get_terraform_inputs_for_helm IS
    'Finds all Terraform outputs that feed into a specific Helm node';

-- Function 3: Find Helm charts consuming a specific Terraform output
CREATE OR REPLACE FUNCTION get_helm_consumers_for_tf(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_tf_node_id UUID,
    p_min_confidence DECIMAL(3,2) DEFAULT 0.00
)
RETURNS TABLE (
    edge_id UUID,
    helm_node_id UUID,
    helm_node_name VARCHAR(500),
    helm_file_path VARCHAR(1000),
    target_value_path TEXT,
    target_chart TEXT,
    flow_mechanism VARCHAR(50),
    pipeline_type VARCHAR(50),
    transformation_type VARCHAR(50),
    confidence DECIMAL(3,2),
    evidence JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.target_node_id AS helm_node_id,
        tgt.name AS helm_node_name,
        tgt.file_path AS helm_file_path,
        COALESCE(e.metadata->>'targetValuePath', '')::TEXT AS target_value_path,
        COALESCE(e.metadata->>'targetChart', '')::TEXT AS target_chart,
        e.flow_mechanism,
        e.pipeline_type,
        e.transformation_type,
        e.confidence,
        e.evidence
    FROM edges e
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'FEEDS_INTO'
      AND e.source_node_id = p_tf_node_id
      AND e.confidence >= p_min_confidence
    ORDER BY e.confidence DESC, tgt.name;
END;
$$;

COMMENT ON FUNCTION get_helm_consumers_for_tf IS
    'Finds all Helm charts that consume data from a specific Terraform output';

-- Function 4: Trace complete data flow chains (recursive)
-- Follows FEEDS_INTO edges to find complete data flow paths
CREATE OR REPLACE FUNCTION get_data_flow_chain(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_start_node_id UUID,
    p_direction VARCHAR(10) DEFAULT 'downstream',
    p_max_depth INTEGER DEFAULT 5
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR(500),
    node_type TEXT,
    file_path VARCHAR(1000),
    edge_id UUID,
    edge_confidence DECIMAL(3,2),
    flow_mechanism VARCHAR(50),
    hop_distance INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_direction = 'upstream' THEN
        -- Trace backwards: find what feeds into this node
        RETURN QUERY
        WITH RECURSIVE flow_chain AS (
            -- Base case: direct inputs to start node
            SELECT
                e.source_node_id AS node_id,
                src.name AS node_name,
                src.type::TEXT AS node_type,
                src.file_path,
                e.id AS edge_id,
                e.confidence AS edge_confidence,
                e.flow_mechanism,
                1 AS hop_distance
            FROM edges e
            JOIN nodes src ON e.source_node_id = src.id
            WHERE e.scan_id = p_scan_id
              AND e.type = 'FEEDS_INTO'
              AND e.target_node_id = p_start_node_id

            UNION ALL

            -- Recursive case: find inputs to current sources
            SELECT
                e.source_node_id AS node_id,
                src.name AS node_name,
                src.type::TEXT AS node_type,
                src.file_path,
                e.id AS edge_id,
                e.confidence AS edge_confidence,
                e.flow_mechanism,
                fc.hop_distance + 1 AS hop_distance
            FROM flow_chain fc
            JOIN edges e ON e.target_node_id = fc.node_id
                AND e.type = 'FEEDS_INTO'
                AND e.scan_id = p_scan_id
            JOIN nodes src ON e.source_node_id = src.id
            WHERE fc.hop_distance < p_max_depth
        )
        SELECT * FROM flow_chain ORDER BY hop_distance, node_name;
    ELSE
        -- Trace forwards: find what this node feeds into
        RETURN QUERY
        WITH RECURSIVE flow_chain AS (
            -- Base case: direct outputs from start node
            SELECT
                e.target_node_id AS node_id,
                tgt.name AS node_name,
                tgt.type::TEXT AS node_type,
                tgt.file_path,
                e.id AS edge_id,
                e.confidence AS edge_confidence,
                e.flow_mechanism,
                1 AS hop_distance
            FROM edges e
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE e.scan_id = p_scan_id
              AND e.type = 'FEEDS_INTO'
              AND e.source_node_id = p_start_node_id

            UNION ALL

            -- Recursive case: find outputs from current targets
            SELECT
                e.target_node_id AS node_id,
                tgt.name AS node_name,
                tgt.type::TEXT AS node_type,
                tgt.file_path,
                e.id AS edge_id,
                e.confidence AS edge_confidence,
                e.flow_mechanism,
                fc.hop_distance + 1 AS hop_distance
            FROM flow_chain fc
            JOIN edges e ON e.source_node_id = fc.node_id
                AND e.type = 'FEEDS_INTO'
                AND e.scan_id = p_scan_id
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE fc.hop_distance < p_max_depth
        )
        SELECT * FROM flow_chain ORDER BY hop_distance, node_name;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_data_flow_chain IS
    'Recursively traces data flow chains upstream or downstream from a starting node';

-- Function 5: Get aggregate statistics for FEEDS_INTO edges in a scan
CREATE OR REPLACE FUNCTION get_feeds_into_stats(
    p_tenant_id UUID,
    p_scan_id UUID
)
RETURNS TABLE (
    total_flows BIGINT,
    avg_confidence DECIMAL(5,2),
    high_confidence_count BIGINT,
    medium_confidence_count BIGINT,
    low_confidence_count BIGINT,
    by_flow_mechanism JSONB,
    by_pipeline_type JSONB,
    by_transformation_type JSONB,
    unique_tf_sources BIGINT,
    unique_helm_targets BIGINT,
    tf_to_helm_ratio DECIMAL(5,2)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_flows,
        COALESCE(AVG(e.confidence), 0)::DECIMAL(5,2) AS avg_confidence,
        COUNT(*) FILTER (WHERE e.confidence >= 0.80)::BIGINT AS high_confidence_count,
        COUNT(*) FILTER (WHERE e.confidence >= 0.50 AND e.confidence < 0.80)::BIGINT AS medium_confidence_count,
        COUNT(*) FILTER (WHERE e.confidence < 0.50)::BIGINT AS low_confidence_count,
        COALESCE(
            jsonb_object_agg(
                COALESCE(e.flow_mechanism, 'unknown'),
                mechanism_counts.cnt
            ) FILTER (WHERE mechanism_counts.cnt IS NOT NULL),
            '{}'::JSONB
        ) AS by_flow_mechanism,
        COALESCE(
            jsonb_object_agg(
                COALESCE(e.pipeline_type, 'unknown'),
                pipeline_counts.cnt
            ) FILTER (WHERE pipeline_counts.cnt IS NOT NULL),
            '{}'::JSONB
        ) AS by_pipeline_type,
        COALESCE(
            jsonb_object_agg(
                COALESCE(e.transformation_type, 'none'),
                transform_counts.cnt
            ) FILTER (WHERE transform_counts.cnt IS NOT NULL),
            '{}'::JSONB
        ) AS by_transformation_type,
        COUNT(DISTINCT e.source_node_id)::BIGINT AS unique_tf_sources,
        COUNT(DISTINCT e.target_node_id)::BIGINT AS unique_helm_targets,
        CASE
            WHEN COUNT(DISTINCT e.target_node_id) = 0 THEN 0
            ELSE (COUNT(DISTINCT e.source_node_id)::DECIMAL / COUNT(DISTINCT e.target_node_id))::DECIMAL(5,2)
        END AS tf_to_helm_ratio
    FROM edges e
    LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM edges e2
        WHERE e2.scan_id = p_scan_id AND e2.type = 'FEEDS_INTO'
        AND e2.flow_mechanism = e.flow_mechanism
    ) mechanism_counts ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM edges e2
        WHERE e2.scan_id = p_scan_id AND e2.type = 'FEEDS_INTO'
        AND e2.pipeline_type = e.pipeline_type
    ) pipeline_counts ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM edges e2
        WHERE e2.scan_id = p_scan_id AND e2.type = 'FEEDS_INTO'
        AND e2.transformation_type = e.transformation_type
    ) transform_counts ON true
    WHERE e.scan_id = p_scan_id
      AND e.type = 'FEEDS_INTO'
    GROUP BY mechanism_counts.cnt, pipeline_counts.cnt, transform_counts.cnt
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_feeds_into_stats IS
    'Returns aggregate statistics for FEEDS_INTO edges in a scan';

-- Function 6: Find FEEDS_INTO edges by confidence range (for review)
CREATE OR REPLACE FUNCTION find_feeds_into_by_confidence(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_min_confidence DECIMAL(3,2) DEFAULT 0.00,
    p_max_confidence DECIMAL(3,2) DEFAULT 1.00,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    edge_id UUID,
    source_node_id UUID,
    source_name VARCHAR(500),
    source_output TEXT,
    target_node_id UUID,
    target_name VARCHAR(500),
    target_value_path TEXT,
    confidence DECIMAL(3,2),
    flow_mechanism VARCHAR(50),
    evidence_summary TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.source_node_id,
        src.name AS source_name,
        COALESCE(e.metadata->>'sourceOutputName', '')::TEXT AS source_output,
        e.target_node_id,
        tgt.name AS target_name,
        COALESCE(e.metadata->>'targetValuePath', '')::TEXT AS target_value_path,
        e.confidence,
        e.flow_mechanism,
        COALESCE(
            (
                SELECT string_agg(ev->>'type', ', ')
                FROM jsonb_array_elements(e.evidence) ev
            ),
            ''
        )::TEXT AS evidence_summary
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'FEEDS_INTO'
      AND e.confidence >= p_min_confidence
      AND e.confidence <= p_max_confidence
    ORDER BY e.confidence ASC, src.file_path
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION find_feeds_into_by_confidence IS
    'Finds FEEDS_INTO edges within a confidence range for manual review';

-- =============================================================================
-- Migration Tracking
-- =============================================================================

INSERT INTO schema_migrations (version)
VALUES ('013_feeds_into_edge')
ON CONFLICT (version) DO NOTHING;
