-- =============================================================================
-- Migration 014: Pipeline Nodes for CI/CD Configuration Graph
-- TASK-XREF-007: Add ci_pipeline and ci_job node types with edges
-- =============================================================================
--
-- Node Types Added:
--   ci_pipeline - Represents a CI/CD pipeline configuration
--   ci_job      - Represents a job within a pipeline
--
-- Edge Types Added:
--   PIPELINE_CONTAINS - Pipeline contains job relationship
--   JOB_DEPENDS_ON    - Job dependency relationship
--   OPERATES_ON       - Job operates on infrastructure node
--
-- Indexes Added:
--   idx_nodes_ci_pipeline        - Index for ci_pipeline nodes by scan
--   idx_nodes_ci_job             - Index for ci_job nodes by scan
--   idx_nodes_ci_job_pipeline    - Index for ci_job by pipeline ID
--   idx_edges_pipeline_contains  - Index for PIPELINE_CONTAINS edges
--   idx_edges_job_depends_on     - Index for JOB_DEPENDS_ON edges
--   idx_edges_operates_on        - Index for OPERATES_ON edges
--   idx_edges_operates_on_target - Reverse index for OPERATES_ON
--
-- Helper Functions Added:
--   get_pipeline_jobs()          - Get all jobs for a pipeline
--   get_job_dependencies()       - Get dependency chain for a job
--   get_infrastructure_for_job() - Get infra nodes operated by a job
--   get_jobs_for_infrastructure()- Get jobs operating on an infra node
--   get_pipeline_stats()         - Aggregate statistics for pipelines
--
-- =============================================================================

-- =============================================================================
-- Add 'ci_pipeline' and 'ci_job' to node_type enum
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'ci_pipeline'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'node_type')
    ) THEN
        ALTER TYPE node_type ADD VALUE 'ci_pipeline';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'ci_job'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'node_type')
    ) THEN
        ALTER TYPE node_type ADD VALUE 'ci_job';
    END IF;
END
$$;

-- =============================================================================
-- Add Edge Types
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'PIPELINE_CONTAINS'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'PIPELINE_CONTAINS';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'JOB_DEPENDS_ON'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'JOB_DEPENDS_ON';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'OPERATES_ON'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'edge_type')
    ) THEN
        ALTER TYPE edge_type ADD VALUE 'OPERATES_ON';
    END IF;
END
$$;

-- =============================================================================
-- Add Columns for Pipeline/Job Edge Metadata
-- =============================================================================

-- Operation performed by job on infrastructure
ALTER TABLE edges ADD COLUMN IF NOT EXISTS operation VARCHAR(100);
COMMENT ON COLUMN edges.operation IS 'Operation performed (e.g., apply, upgrade, deploy)';

-- Operation type classification
ALTER TABLE edges ADD COLUMN IF NOT EXISTS operation_type VARCHAR(50);
COMMENT ON COLUMN edges.operation_type IS 'Type of operation (terraform, helm, kubectl, docker, script)';

-- Step index within job
ALTER TABLE edges ADD COLUMN IF NOT EXISTS step_index INTEGER;
COMMENT ON COLUMN edges.step_index IS 'Step index within the job where operation occurs';

-- =============================================================================
-- Performance Indexes for Pipeline Nodes
-- =============================================================================

-- Index 1: CI Pipeline nodes by scan
-- Optimizes queries for "get all pipelines in a scan"
CREATE INDEX IF NOT EXISTS idx_nodes_ci_pipeline
ON nodes (scan_id)
WHERE type = 'ci_pipeline';

-- Index 2: CI Job nodes by scan
-- Optimizes queries for "get all jobs in a scan"
CREATE INDEX IF NOT EXISTS idx_nodes_ci_job
ON nodes (scan_id)
WHERE type = 'ci_job';

-- Index 3: CI Job nodes by pipeline ID (from metadata)
-- Optimizes queries for "get all jobs in a pipeline"
CREATE INDEX IF NOT EXISTS idx_nodes_ci_job_pipeline
ON nodes ((metadata->>'pipelineId'))
WHERE type = 'ci_job';

-- Index 4: Pipeline metadata GIN index
-- Enables efficient JSONB queries on pipeline metadata
CREATE INDEX IF NOT EXISTS idx_nodes_ci_pipeline_metadata
ON nodes USING gin (metadata jsonb_path_ops)
WHERE type = 'ci_pipeline';

-- Index 5: Job metadata GIN index
-- Enables efficient JSONB queries on job metadata
CREATE INDEX IF NOT EXISTS idx_nodes_ci_job_metadata
ON nodes USING gin (metadata jsonb_path_ops)
WHERE type = 'ci_job';

-- =============================================================================
-- Performance Indexes for Pipeline Edges
-- =============================================================================

-- Index 6: PIPELINE_CONTAINS edges
-- Optimizes finding jobs contained in a pipeline
CREATE INDEX IF NOT EXISTS idx_edges_pipeline_contains
ON edges (source_node_id, scan_id)
WHERE type = 'PIPELINE_CONTAINS';

-- Index 7: JOB_DEPENDS_ON edges (forward lookup)
-- Optimizes finding job dependencies
CREATE INDEX IF NOT EXISTS idx_edges_job_depends_on
ON edges (target_node_id, scan_id)
WHERE type = 'JOB_DEPENDS_ON';

-- Index 8: JOB_DEPENDS_ON edges (reverse lookup)
-- Optimizes finding jobs that depend on a given job
CREATE INDEX IF NOT EXISTS idx_edges_job_depends_on_reverse
ON edges (source_node_id, scan_id)
WHERE type = 'JOB_DEPENDS_ON';

-- Index 9: OPERATES_ON edges (forward lookup)
-- Optimizes finding infrastructure operated by a job
CREATE INDEX IF NOT EXISTS idx_edges_operates_on
ON edges (source_node_id, scan_id)
WHERE type = 'OPERATES_ON';

-- Index 10: OPERATES_ON edges (reverse lookup)
-- Optimizes finding jobs operating on infrastructure
CREATE INDEX IF NOT EXISTS idx_edges_operates_on_target
ON edges (target_node_id, scan_id)
WHERE type = 'OPERATES_ON';

-- Index 11: OPERATES_ON by operation type
-- Optimizes filtering by operation type
CREATE INDEX IF NOT EXISTS idx_edges_operates_on_type
ON edges (operation_type, scan_id)
WHERE type = 'OPERATES_ON' AND operation_type IS NOT NULL;

-- Index 12: OPERATES_ON by confidence
-- Optimizes confidence-based filtering
CREATE INDEX IF NOT EXISTS idx_edges_operates_on_confidence
ON edges (confidence DESC, scan_id)
WHERE type = 'OPERATES_ON';

-- =============================================================================
-- Index Comments
-- =============================================================================

COMMENT ON INDEX idx_nodes_ci_pipeline IS
    'Optimizes queries for CI pipeline nodes by scan';

COMMENT ON INDEX idx_nodes_ci_job IS
    'Optimizes queries for CI job nodes by scan';

COMMENT ON INDEX idx_nodes_ci_job_pipeline IS
    'Optimizes finding jobs belonging to a specific pipeline';

COMMENT ON INDEX idx_edges_pipeline_contains IS
    'Optimizes finding jobs contained within a pipeline';

COMMENT ON INDEX idx_edges_job_depends_on IS
    'Optimizes finding dependencies for a job';

COMMENT ON INDEX idx_edges_operates_on IS
    'Optimizes finding infrastructure operated by a job';

COMMENT ON INDEX idx_edges_operates_on_target IS
    'Optimizes finding jobs that operate on infrastructure';

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function 1: Get all jobs for a pipeline with details
CREATE OR REPLACE FUNCTION get_pipeline_jobs(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_pipeline_id VARCHAR(500)
)
RETURNS TABLE (
    job_id UUID,
    job_name VARCHAR(500),
    file_path VARCHAR(1000),
    stage TEXT,
    runs_on TEXT,
    environment TEXT,
    depends_on JSONB,
    operations JSONB,
    has_terraform BOOLEAN,
    has_helm BOOLEAN,
    line_start INTEGER,
    line_end INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id AS job_id,
        n.name AS job_name,
        n.file_path,
        (n.metadata->>'stage')::TEXT AS stage,
        (n.metadata->>'runsOn')::TEXT AS runs_on,
        (n.metadata->>'environment')::TEXT AS environment,
        (n.metadata->'dependsOn')::JSONB AS depends_on,
        (n.metadata->'operations')::JSONB AS operations,
        EXISTS (
            SELECT 1 FROM jsonb_array_elements(n.metadata->'operations') op
            WHERE op->>'type' = 'terraform'
        ) AS has_terraform,
        EXISTS (
            SELECT 1 FROM jsonb_array_elements(n.metadata->'operations') op
            WHERE op->>'type' = 'helm'
        ) AS has_helm,
        n.line_start,
        n.line_end
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'ci_job'
      AND n.metadata->>'pipelineId' = p_pipeline_id
    ORDER BY COALESCE(n.metadata->>'stage', 'test'), n.name;
END;
$$;

COMMENT ON FUNCTION get_pipeline_jobs IS
    'Retrieves all jobs for a specific pipeline with metadata';

-- Function 2: Get job dependency chain (recursive)
CREATE OR REPLACE FUNCTION get_job_dependencies(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_job_id UUID,
    p_direction VARCHAR(10) DEFAULT 'upstream',
    p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
    job_id UUID,
    job_name VARCHAR(500),
    file_path VARCHAR(1000),
    stage TEXT,
    edge_id UUID,
    hop_distance INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_direction = 'upstream' THEN
        -- Find jobs this job depends on
        RETURN QUERY
        WITH RECURSIVE dep_chain AS (
            -- Base case: direct dependencies
            SELECT
                e.source_node_id AS job_id,
                src.name AS job_name,
                src.file_path,
                (src.metadata->>'stage')::TEXT AS stage,
                e.id AS edge_id,
                1 AS hop_distance
            FROM edges e
            JOIN nodes src ON e.source_node_id = src.id
            WHERE e.scan_id = p_scan_id
              AND e.type = 'JOB_DEPENDS_ON'
              AND e.target_node_id = p_job_id

            UNION ALL

            -- Recursive case: dependencies of dependencies
            SELECT
                e.source_node_id AS job_id,
                src.name AS job_name,
                src.file_path,
                (src.metadata->>'stage')::TEXT AS stage,
                e.id AS edge_id,
                dc.hop_distance + 1 AS hop_distance
            FROM dep_chain dc
            JOIN edges e ON e.target_node_id = dc.job_id
                AND e.type = 'JOB_DEPENDS_ON'
                AND e.scan_id = p_scan_id
            JOIN nodes src ON e.source_node_id = src.id
            WHERE dc.hop_distance < p_max_depth
        )
        SELECT * FROM dep_chain ORDER BY hop_distance, job_name;
    ELSE
        -- Find jobs that depend on this job
        RETURN QUERY
        WITH RECURSIVE dep_chain AS (
            -- Base case: direct dependents
            SELECT
                e.target_node_id AS job_id,
                tgt.name AS job_name,
                tgt.file_path,
                (tgt.metadata->>'stage')::TEXT AS stage,
                e.id AS edge_id,
                1 AS hop_distance
            FROM edges e
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE e.scan_id = p_scan_id
              AND e.type = 'JOB_DEPENDS_ON'
              AND e.source_node_id = p_job_id

            UNION ALL

            -- Recursive case: dependents of dependents
            SELECT
                e.target_node_id AS job_id,
                tgt.name AS job_name,
                tgt.file_path,
                (tgt.metadata->>'stage')::TEXT AS stage,
                e.id AS edge_id,
                dc.hop_distance + 1 AS hop_distance
            FROM dep_chain dc
            JOIN edges e ON e.source_node_id = dc.job_id
                AND e.type = 'JOB_DEPENDS_ON'
                AND e.scan_id = p_scan_id
            JOIN nodes tgt ON e.target_node_id = tgt.id
            WHERE dc.hop_distance < p_max_depth
        )
        SELECT * FROM dep_chain ORDER BY hop_distance, job_name;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_job_dependencies IS
    'Recursively retrieves job dependency chain upstream or downstream';

-- Function 3: Get infrastructure nodes operated by a job
CREATE OR REPLACE FUNCTION get_infrastructure_for_job(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_job_id UUID,
    p_min_confidence DECIMAL(3,2) DEFAULT 0.00
)
RETURNS TABLE (
    edge_id UUID,
    target_node_id UUID,
    target_name VARCHAR(500),
    target_type TEXT,
    target_file_path VARCHAR(1000),
    operation VARCHAR(100),
    operation_type VARCHAR(50),
    step_index INTEGER,
    confidence DECIMAL(3,2)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.target_node_id,
        tgt.name AS target_name,
        tgt.type::TEXT AS target_type,
        tgt.file_path AS target_file_path,
        e.operation,
        e.operation_type,
        e.step_index,
        e.confidence
    FROM edges e
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'OPERATES_ON'
      AND e.source_node_id = p_job_id
      AND e.confidence >= p_min_confidence
    ORDER BY e.step_index, e.confidence DESC;
END;
$$;

COMMENT ON FUNCTION get_infrastructure_for_job IS
    'Retrieves all infrastructure nodes operated on by a specific job';

-- Function 4: Get jobs that operate on an infrastructure node
CREATE OR REPLACE FUNCTION get_jobs_for_infrastructure(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_infra_node_id UUID,
    p_min_confidence DECIMAL(3,2) DEFAULT 0.00
)
RETURNS TABLE (
    edge_id UUID,
    job_id UUID,
    job_name VARCHAR(500),
    pipeline_id TEXT,
    job_file_path VARCHAR(1000),
    operation VARCHAR(100),
    operation_type VARCHAR(50),
    step_index INTEGER,
    confidence DECIMAL(3,2)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS edge_id,
        e.source_node_id AS job_id,
        src.name AS job_name,
        (src.metadata->>'pipelineId')::TEXT AS pipeline_id,
        src.file_path AS job_file_path,
        e.operation,
        e.operation_type,
        e.step_index,
        e.confidence
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'OPERATES_ON'
      AND e.target_node_id = p_infra_node_id
      AND e.confidence >= p_min_confidence
    ORDER BY e.confidence DESC, src.name;
END;
$$;

COMMENT ON FUNCTION get_jobs_for_infrastructure IS
    'Retrieves all CI jobs that operate on a specific infrastructure node';

-- Function 5: Get pipeline statistics
CREATE OR REPLACE FUNCTION get_pipeline_stats(
    p_tenant_id UUID,
    p_scan_id UUID
)
RETURNS TABLE (
    total_pipelines BIGINT,
    total_jobs BIGINT,
    pipelines_with_terraform BIGINT,
    pipelines_with_helm BIGINT,
    jobs_with_dependencies BIGINT,
    jobs_operating_on_infra BIGINT,
    avg_jobs_per_pipeline DECIMAL(5,2),
    by_pipeline_type JSONB,
    by_trigger_type JSONB,
    by_operation_type JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH pipeline_data AS (
        SELECT
            n.id,
            n.metadata->>'pipelineType' AS pipeline_type,
            (n.metadata->>'hasTerraformJobs')::BOOLEAN AS has_tf,
            (n.metadata->>'hasHelmJobs')::BOOLEAN AS has_helm,
            (n.metadata->>'jobCount')::INTEGER AS job_count,
            n.metadata->'triggers' AS triggers
        FROM nodes n
        WHERE n.scan_id = p_scan_id
          AND n.type = 'ci_pipeline'
    ),
    job_data AS (
        SELECT
            j.id,
            j.metadata->>'pipelineId' AS pipeline_id,
            jsonb_array_length(j.metadata->'dependsOn') > 0 AS has_deps,
            EXISTS (
                SELECT 1 FROM edges e
                WHERE e.source_node_id = j.id
                  AND e.type = 'OPERATES_ON'
                  AND e.scan_id = p_scan_id
            ) AS operates_on_infra
        FROM nodes j
        WHERE j.scan_id = p_scan_id
          AND j.type = 'ci_job'
    ),
    operation_data AS (
        SELECT e.operation_type, COUNT(*) as cnt
        FROM edges e
        WHERE e.scan_id = p_scan_id
          AND e.type = 'OPERATES_ON'
          AND e.operation_type IS NOT NULL
        GROUP BY e.operation_type
    )
    SELECT
        (SELECT COUNT(*) FROM pipeline_data)::BIGINT AS total_pipelines,
        (SELECT COUNT(*) FROM job_data)::BIGINT AS total_jobs,
        (SELECT COUNT(*) FROM pipeline_data WHERE has_tf)::BIGINT AS pipelines_with_terraform,
        (SELECT COUNT(*) FROM pipeline_data WHERE has_helm)::BIGINT AS pipelines_with_helm,
        (SELECT COUNT(*) FROM job_data WHERE has_deps)::BIGINT AS jobs_with_dependencies,
        (SELECT COUNT(*) FROM job_data WHERE operates_on_infra)::BIGINT AS jobs_operating_on_infra,
        COALESCE(
            (SELECT AVG(job_count)::DECIMAL(5,2) FROM pipeline_data),
            0
        ) AS avg_jobs_per_pipeline,
        COALESCE(
            (SELECT jsonb_object_agg(pipeline_type, cnt) FROM (
                SELECT pipeline_type, COUNT(*) as cnt
                FROM pipeline_data
                WHERE pipeline_type IS NOT NULL
                GROUP BY pipeline_type
            ) pt),
            '{}'::JSONB
        ) AS by_pipeline_type,
        COALESCE(
            (SELECT jsonb_object_agg(trigger_type, cnt) FROM (
                SELECT t->>'type' AS trigger_type, COUNT(*) as cnt
                FROM pipeline_data p, jsonb_array_elements(p.triggers) t
                GROUP BY t->>'type'
            ) tt),
            '{}'::JSONB
        ) AS by_trigger_type,
        COALESCE(
            (SELECT jsonb_object_agg(operation_type, cnt) FROM operation_data),
            '{}'::JSONB
        ) AS by_operation_type;
END;
$$;

COMMENT ON FUNCTION get_pipeline_stats IS
    'Returns aggregate statistics for CI/CD pipelines in a scan';

-- Function 6: Get complete pipeline graph (nodes and edges)
CREATE OR REPLACE FUNCTION get_pipeline_graph(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_pipeline_id VARCHAR(500)
)
RETURNS TABLE (
    element_type TEXT,
    element_id UUID,
    element_name VARCHAR(500),
    element_data JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Return pipeline node
    RETURN QUERY
    SELECT
        'pipeline'::TEXT AS element_type,
        n.id AS element_id,
        n.name AS element_name,
        jsonb_build_object(
            'type', n.type,
            'filePath', n.file_path,
            'metadata', n.metadata
        ) AS element_data
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'ci_pipeline'
      AND n.id::TEXT = p_pipeline_id;

    -- Return job nodes
    RETURN QUERY
    SELECT
        'job'::TEXT AS element_type,
        n.id AS element_id,
        n.name AS element_name,
        jsonb_build_object(
            'type', n.type,
            'filePath', n.file_path,
            'stage', n.metadata->>'stage',
            'runsOn', n.metadata->>'runsOn',
            'operations', n.metadata->'operations'
        ) AS element_data
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'ci_job'
      AND n.metadata->>'pipelineId' = p_pipeline_id;

    -- Return PIPELINE_CONTAINS edges
    RETURN QUERY
    SELECT
        'contains_edge'::TEXT AS element_type,
        e.id AS element_id,
        NULL::VARCHAR(500) AS element_name,
        jsonb_build_object(
            'type', e.type,
            'sourceNodeId', e.source_node_id,
            'targetNodeId', e.target_node_id,
            'confidence', e.confidence
        ) AS element_data
    FROM edges e
    WHERE e.scan_id = p_scan_id
      AND e.type = 'PIPELINE_CONTAINS'
      AND e.source_node_id::TEXT = p_pipeline_id;

    -- Return JOB_DEPENDS_ON edges
    RETURN QUERY
    SELECT
        'depends_edge'::TEXT AS element_type,
        e.id AS element_id,
        NULL::VARCHAR(500) AS element_name,
        jsonb_build_object(
            'type', e.type,
            'sourceNodeId', e.source_node_id,
            'targetNodeId', e.target_node_id,
            'confidence', e.confidence,
            'metadata', e.metadata
        ) AS element_data
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'JOB_DEPENDS_ON'
      AND src.metadata->>'pipelineId' = p_pipeline_id;

    -- Return OPERATES_ON edges for jobs in this pipeline
    RETURN QUERY
    SELECT
        'operates_edge'::TEXT AS element_type,
        e.id AS element_id,
        NULL::VARCHAR(500) AS element_name,
        jsonb_build_object(
            'type', e.type,
            'sourceNodeId', e.source_node_id,
            'targetNodeId', e.target_node_id,
            'confidence', e.confidence,
            'operation', e.operation,
            'operationType', e.operation_type
        ) AS element_data
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    WHERE e.scan_id = p_scan_id
      AND e.type = 'OPERATES_ON'
      AND src.metadata->>'pipelineId' = p_pipeline_id;
END;
$$;

COMMENT ON FUNCTION get_pipeline_graph IS
    'Returns complete graph structure for a pipeline including nodes and edges';

-- Function 7: Find pipelines by trigger type
CREATE OR REPLACE FUNCTION find_pipelines_by_trigger(
    p_tenant_id UUID,
    p_scan_id UUID,
    p_trigger_type VARCHAR(50)
)
RETURNS TABLE (
    pipeline_id UUID,
    pipeline_name VARCHAR(500),
    file_path VARCHAR(1000),
    pipeline_type TEXT,
    job_count INTEGER,
    has_terraform BOOLEAN,
    has_helm BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id AS pipeline_id,
        n.name AS pipeline_name,
        n.file_path,
        (n.metadata->>'pipelineType')::TEXT AS pipeline_type,
        (n.metadata->>'jobCount')::INTEGER AS job_count,
        (n.metadata->>'hasTerraformJobs')::BOOLEAN AS has_terraform,
        (n.metadata->>'hasHelmJobs')::BOOLEAN AS has_helm
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.type = 'ci_pipeline'
      AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(n.metadata->'triggers') t
          WHERE t->>'type' = p_trigger_type
      )
    ORDER BY n.name;
END;
$$;

COMMENT ON FUNCTION find_pipelines_by_trigger IS
    'Finds pipelines that have a specific trigger type configured';

-- Function 8: Get OPERATES_ON statistics
CREATE OR REPLACE FUNCTION get_operates_on_stats(
    p_tenant_id UUID,
    p_scan_id UUID
)
RETURNS TABLE (
    total_edges BIGINT,
    avg_confidence DECIMAL(5,2),
    high_confidence_count BIGINT,
    medium_confidence_count BIGINT,
    low_confidence_count BIGINT,
    by_operation_type JSONB,
    unique_jobs BIGINT,
    unique_targets BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_edges,
        COALESCE(AVG(e.confidence), 0)::DECIMAL(5,2) AS avg_confidence,
        COUNT(*) FILTER (WHERE e.confidence >= 0.80)::BIGINT AS high_confidence_count,
        COUNT(*) FILTER (WHERE e.confidence >= 0.50 AND e.confidence < 0.80)::BIGINT AS medium_confidence_count,
        COUNT(*) FILTER (WHERE e.confidence < 0.50)::BIGINT AS low_confidence_count,
        COALESCE(
            (SELECT jsonb_object_agg(operation_type, cnt) FROM (
                SELECT e2.operation_type, COUNT(*) as cnt
                FROM edges e2
                WHERE e2.scan_id = p_scan_id
                  AND e2.type = 'OPERATES_ON'
                  AND e2.operation_type IS NOT NULL
                GROUP BY e2.operation_type
            ) ot),
            '{}'::JSONB
        ) AS by_operation_type,
        COUNT(DISTINCT e.source_node_id)::BIGINT AS unique_jobs,
        COUNT(DISTINCT e.target_node_id)::BIGINT AS unique_targets
    FROM edges e
    WHERE e.scan_id = p_scan_id
      AND e.type = 'OPERATES_ON';
END;
$$;

COMMENT ON FUNCTION get_operates_on_stats IS
    'Returns aggregate statistics for OPERATES_ON edges in a scan';

-- =============================================================================
-- Migration Tracking
-- =============================================================================

INSERT INTO schema_migrations (version)
VALUES ('014_pipeline_nodes')
ON CONFLICT (version) DO NOTHING;
