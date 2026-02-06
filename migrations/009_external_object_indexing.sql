-- =============================================================================
-- Migration 009: External Object Indexing
-- TASK-ROLLUP-003: External Object Index with reverse lookup support
-- NFR-PERF-008: 100K nodes < 500ms benchmark target
-- =============================================================================

-- =============================================================================
-- External Objects Master Table (if not exists)
-- This table stores unique external objects across all repositories
-- =============================================================================
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
        ref_type IN ('arn', 'resource_id', 'k8s_reference', 'gcp_resource',
                     'azure_resource', 'container_image', 'git_url', 'storage_path')
    )
);

-- Performance indexes for external_objects_master
CREATE INDEX IF NOT EXISTS idx_eom_tenant_type ON external_objects_master(tenant_id, ref_type);
CREATE INDEX IF NOT EXISTS idx_eom_reference_hash ON external_objects_master(reference_hash);
CREATE INDEX IF NOT EXISTS idx_eom_normalized_id ON external_objects_master(tenant_id, normalized_id);
CREATE INDEX IF NOT EXISTS idx_eom_provider ON external_objects_master(tenant_id, provider) WHERE provider IS NOT NULL;

COMMENT ON TABLE external_objects_master IS 'Master table for unique external objects (ARNs, Resource IDs, K8s refs)';
COMMENT ON COLUMN external_objects_master.reference_hash IS 'SHA-256 hash of ref_type:normalized_id for fast lookup';
COMMENT ON COLUMN external_objects_master.normalized_id IS 'Lowercase, normalized version of external_id for matching';

-- =============================================================================
-- Node-External Object Junction Table
-- CRITICAL: This is the main table for the external object index
-- Provides O(1) lookup by external ID and reverse lookup by node
-- =============================================================================
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
        ref_type IN ('arn', 'resource_id', 'k8s_reference', 'gcp_resource',
                     'azure_resource', 'container_image', 'git_url', 'storage_path')
    )
);

-- =============================================================================
-- Performance Indexes for NFR-PERF-008 (100K nodes < 500ms)
-- 8 strategic indexes for covering common query patterns
-- =============================================================================

-- Index 1: Tenant + Repository composite (tenant isolation + repo filtering)
CREATE INDEX IF NOT EXISTS idx_neo_tenant_repo
    ON node_external_objects(tenant_id, repository_id);

-- Index 2: External object lookup (reverse lookup: external -> nodes)
CREATE INDEX IF NOT EXISTS idx_neo_external_object
    ON node_external_objects(external_object_id);

-- Index 3: Reference hash lookup (fast O(1) lookup by computed hash)
-- CRITICAL for NFR-PERF-008 < 20ms lookup target
CREATE INDEX IF NOT EXISTS idx_neo_reference_hash
    ON node_external_objects(reference_hash);

-- Index 4: Node lookup (forward lookup: node -> externals)
CREATE INDEX IF NOT EXISTS idx_neo_node_id
    ON node_external_objects(node_id);

-- Index 5: Scan-based operations (bulk operations, cleanup)
CREATE INDEX IF NOT EXISTS idx_neo_scan_id
    ON node_external_objects(scan_id);

-- Index 6: Tenant + Ref Type (filtering by reference type within tenant)
CREATE INDEX IF NOT EXISTS idx_neo_tenant_ref_type
    ON node_external_objects(tenant_id, ref_type);

-- Index 7: Covering index for pagination queries
-- Includes tenant_id, repository_id, created_at for efficient LIMIT/OFFSET
CREATE INDEX IF NOT EXISTS idx_neo_tenant_repo_created
    ON node_external_objects(tenant_id, repository_id, created_at DESC);

-- Index 8: Confidence-based filtering (for high-confidence queries)
CREATE INDEX IF NOT EXISTS idx_neo_confidence
    ON node_external_objects(tenant_id, confidence DESC)
    WHERE confidence >= 0.80;

-- =============================================================================
-- Enable Row-Level Security (RLS) for Multi-Tenancy
-- =============================================================================

ALTER TABLE external_objects_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_external_objects ENABLE ROW LEVEL SECURITY;

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

-- =============================================================================
-- External Object Index Table (Flat Denormalized for Performance)
-- This is the primary index table optimized for fast lookups
-- =============================================================================
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
        reference_type IN ('arn', 'resource_id', 'k8s_reference', 'gcp_resource',
                           'azure_resource', 'container_image', 'git_url', 'storage_path')
    )
);

-- Performance indexes for external_object_index
CREATE INDEX IF NOT EXISTS idx_eoi_tenant_repo ON external_object_index(tenant_id, repository_id);
CREATE INDEX IF NOT EXISTS idx_eoi_external_id ON external_object_index(tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_eoi_normalized_id ON external_object_index(tenant_id, normalized_id);
CREATE INDEX IF NOT EXISTS idx_eoi_node_id ON external_object_index(tenant_id, node_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_eoi_scan_id ON external_object_index(scan_id);
CREATE INDEX IF NOT EXISTS idx_eoi_ref_type ON external_object_index(tenant_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_eoi_indexed_at ON external_object_index(tenant_id, indexed_at DESC);

-- GIN index for JSONB component searches
CREATE INDEX IF NOT EXISTS idx_eoi_components ON external_object_index USING GIN (components);

-- RLS for external_object_index
ALTER TABLE external_object_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eoi_tenant_isolation ON external_object_index;
CREATE POLICY eoi_tenant_isolation ON external_object_index
    USING (tenant_id::text = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE external_object_index IS 'Denormalized index for fast external object lookups (NFR-PERF-008)';

-- =============================================================================
-- Helper Functions
-- =============================================================================

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

-- =============================================================================
-- Triggers for Updated At
-- =============================================================================

CREATE TRIGGER update_external_objects_master_updated_at
    BEFORE UPDATE ON external_objects_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Migration Tracking
-- =============================================================================

INSERT INTO schema_migrations (version)
VALUES ('009_external_object_indexing')
ON CONFLICT (version) DO NOTHING;
