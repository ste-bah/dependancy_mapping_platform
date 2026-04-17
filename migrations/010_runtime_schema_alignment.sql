-- =============================================================================
-- Migration 010: Runtime Schema Alignment
-- Aligns database shape with the active repository and route layer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tenant context helpers expected by the runtime middleware
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', COALESCE(p_tenant_id::TEXT, ''), false);
  PERFORM set_config('app.current_user_id', COALESCE(p_user_id::TEXT, ''), false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', '', false);
  PERFORM set_config('app.current_user_id', '', false);
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Scan status enum additions used by the repository layer
-- -----------------------------------------------------------------------------

ALTER TYPE scan_status ADD VALUE IF NOT EXISTS 'queued';
ALTER TYPE scan_status ADD VALUE IF NOT EXISTS 'running';

-- -----------------------------------------------------------------------------
-- Repositories table alignment
-- -----------------------------------------------------------------------------

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS provider_id TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS html_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_scan_id UUID,
  ADD COLUMN IF NOT EXISTS last_scan_status scan_status,
  ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_id TEXT;

UPDATE repositories
SET
  full_name = COALESCE(full_name, owner || '/' || name),
  html_url = COALESCE(html_url, clone_url),
  last_scanned_at = COALESCE(last_scanned_at, last_scan_at)
WHERE full_name IS NULL OR html_url IS NULL OR last_scanned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_repositories_last_scan_id ON repositories(last_scan_id);
CREATE INDEX IF NOT EXISTS idx_repositories_last_scanned_at ON repositories(last_scanned_at DESC NULLS LAST);

-- -----------------------------------------------------------------------------
-- Scans table alignment
-- -----------------------------------------------------------------------------

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS initiated_by UUID,
  ADD COLUMN IF NOT EXISTS ref TEXT,
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_summary JSONB,
  ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}'::jsonb;

UPDATE scans s
SET
  tenant_id = COALESCE(s.tenant_id, r.tenant_id),
  ref = COALESCE(s.ref, s.branch, r.default_branch, 'main'),
  config = CASE
    WHEN s.config IS NULL OR s.config = '{}'::jsonb THEN COALESCE(s.scan_config, '{}'::jsonb)
    ELSE s.config
  END,
  progress = CASE
    WHEN s.progress IS NULL OR s.progress = '{}'::jsonb THEN jsonb_build_object(
      'phase', CASE s.status
        WHEN 'pending' THEN 'initializing'
        WHEN 'queued' THEN 'initializing'
        WHEN 'running' THEN 'parsing'
        WHEN 'cloning' THEN 'cloning'
        WHEN 'analyzing' THEN 'detecting'
        WHEN 'indexing' THEN 'storing'
        WHEN 'completed' THEN 'completed'
        WHEN 'failed' THEN 'failed'
        WHEN 'cancelled' THEN 'failed'
        ELSE 'initializing'
      END,
      'percentage', CASE s.status
        WHEN 'completed' THEN 100
        WHEN 'failed' THEN 100
        WHEN 'cancelled' THEN 100
        ELSE 0
      END,
      'filesProcessed', 0,
      'totalFiles', 0,
      'nodesDetected', COALESCE(s.node_count, 0),
      'edgesDetected', COALESCE(s.edge_count, 0),
      'errors', CASE WHEN s.error_message IS NULL THEN 0 ELSE 1 END,
      'warnings', 0
    )
    ELSE s.progress
  END,
  result_summary = CASE
    WHEN s.result_summary IS NULL AND (COALESCE(s.node_count, 0) > 0 OR COALESCE(s.edge_count, 0) > 0) THEN jsonb_build_object(
      'totalNodes', COALESCE(s.node_count, 0),
      'totalEdges', COALESCE(s.edge_count, 0),
      'nodesByType', '{}'::jsonb,
      'edgesByType', '{}'::jsonb,
      'filesAnalyzed', 0,
      'errors', '[]'::jsonb,
      'warnings', '[]'::jsonb,
      'confidenceDistribution', jsonb_build_object(
        'certain', 0,
        'high', 0,
        'medium', 0,
        'low', 0,
        'uncertain', 0
      )
    )
    ELSE s.result_summary
  END
FROM repositories r
WHERE r.id = s.repository_id;

CREATE INDEX IF NOT EXISTS idx_scans_tenant_id ON scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scans_tenant_repository_created ON scans(tenant_id, repository_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Nodes table alignment
-- -----------------------------------------------------------------------------

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS original_id TEXT,
  ADD COLUMN IF NOT EXISTS node_type TEXT,
  ADD COLUMN IF NOT EXISTS column_start INTEGER,
  ADD COLUMN IF NOT EXISTS column_end INTEGER;

UPDATE nodes n
SET
  tenant_id = COALESCE(n.tenant_id, s.tenant_id, r.tenant_id),
  original_id = COALESCE(n.original_id, n.id::TEXT),
  node_type = COALESCE(n.node_type, n.type::TEXT)
FROM scans s
JOIN repositories r ON r.id = s.repository_id
WHERE s.id = n.scan_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nodes_scan_tenant_original_id ON nodes(scan_id, tenant_id, original_id);
CREATE INDEX IF NOT EXISTS idx_nodes_tenant_scan ON nodes(tenant_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_nodes_node_type ON nodes(node_type);

-- -----------------------------------------------------------------------------
-- Edges table alignment
-- -----------------------------------------------------------------------------

ALTER TABLE edges
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS original_id TEXT,
  ADD COLUMN IF NOT EXISTS edge_type TEXT,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS is_implicit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attribute TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

UPDATE edges e
SET
  tenant_id = COALESCE(e.tenant_id, s.tenant_id, r.tenant_id),
  original_id = COALESCE(e.original_id, e.id::TEXT),
  edge_type = COALESCE(e.edge_type, e.type::TEXT),
  metadata = COALESCE(NULLIF(e.metadata, '{}'::jsonb), e.evidence, '{}'::jsonb),
  confidence = CASE
    WHEN e.confidence <= 1 THEN ROUND((e.confidence * 100.0)::numeric, 2)
    ELSE e.confidence
  END
FROM scans s
JOIN repositories r ON r.id = s.repository_id
WHERE s.id = e.scan_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_edges_scan_tenant_original_id ON edges(scan_id, tenant_id, original_id);
CREATE INDEX IF NOT EXISTS idx_edges_tenant_scan ON edges(tenant_id, scan_id);
CREATE INDEX IF NOT EXISTS idx_edges_edge_type ON edges(edge_type);

INSERT INTO schema_migrations (version) VALUES ('010_runtime_schema_alignment');
