-- =============================================================================
-- Migration 004: Row-Level Security Policies
-- Multi-tenant data isolation using PostgreSQL RLS
-- TASK-INFRA-002: Row-Level Security (RLS) Policies
-- =============================================================================

-- =============================================================================
-- Tenant Context Functions
-- =============================================================================

-- Get current tenant ID from session settings
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Set current tenant ID for the session
CREATE OR REPLACE FUNCTION set_tenant_id(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- Clear tenant context (for admin operations)
CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', '', false);
END;
$$ LANGUAGE plpgsql;

-- Validate tenant exists before setting context
CREATE OR REPLACE FUNCTION set_tenant_id_validated(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tenant_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM tenants WHERE id = p_tenant_id) INTO tenant_exists;

  IF tenant_exists THEN
    PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, false);
    RETURN TRUE;
  ELSE
    RAISE WARNING 'Tenant % does not exist', p_tenant_id;
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Enable RLS on Tenant-Scoped Tables
-- =============================================================================

-- Repositories (direct tenant reference)
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories FORCE ROW LEVEL SECURITY;

-- External Objects (direct tenant reference)
ALTER TABLE external_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_objects FORCE ROW LEVEL SECURITY;

-- Scans (tenant via repository)
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans FORCE ROW LEVEL SECURITY;

-- Nodes (tenant via scan->repository)
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes FORCE ROW LEVEL SECURITY;

-- Edges (tenant via scan->repository)
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies for Repositories
-- =============================================================================

-- Policy for SELECT operations
CREATE POLICY repositories_tenant_select ON repositories
  FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Policy for INSERT operations
CREATE POLICY repositories_tenant_insert ON repositories
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

-- Policy for UPDATE operations
CREATE POLICY repositories_tenant_update ON repositories
  FOR UPDATE
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Policy for DELETE operations
CREATE POLICY repositories_tenant_delete ON repositories
  FOR DELETE
  USING (tenant_id = current_tenant_id());

-- =============================================================================
-- RLS Policies for External Objects
-- =============================================================================

CREATE POLICY external_objects_tenant_select ON external_objects
  FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY external_objects_tenant_insert ON external_objects
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY external_objects_tenant_update ON external_objects
  FOR UPDATE
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY external_objects_tenant_delete ON external_objects
  FOR DELETE
  USING (tenant_id = current_tenant_id());

-- =============================================================================
-- RLS Policies for Scans (tenant via repository join)
-- =============================================================================

CREATE POLICY scans_tenant_select ON scans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM repositories r
      WHERE r.id = scans.repository_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY scans_tenant_insert ON scans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repositories r
      WHERE r.id = scans.repository_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY scans_tenant_update ON scans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM repositories r
      WHERE r.id = scans.repository_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY scans_tenant_delete ON scans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM repositories r
      WHERE r.id = scans.repository_id
        AND r.tenant_id = current_tenant_id()
    )
  );

-- =============================================================================
-- RLS Policies for Nodes (tenant via scan->repository)
-- =============================================================================

CREATE POLICY nodes_tenant_select ON nodes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = nodes.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY nodes_tenant_insert ON nodes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = nodes.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY nodes_tenant_update ON nodes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = nodes.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY nodes_tenant_delete ON nodes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = nodes.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

-- =============================================================================
-- RLS Policies for Edges (tenant via scan->repository)
-- =============================================================================

CREATE POLICY edges_tenant_select ON edges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = edges.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY edges_tenant_insert ON edges
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = edges.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY edges_tenant_update ON edges
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = edges.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY edges_tenant_delete ON edges
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scans s
      JOIN repositories r ON r.id = s.repository_id
      WHERE s.id = edges.scan_id
        AND r.tenant_id = current_tenant_id()
    )
  );

-- =============================================================================
-- Performance Optimization: Materialized Tenant Lookup
-- =============================================================================

-- Create a function to efficiently check tenant ownership
-- This can be used by other policies for better performance
CREATE OR REPLACE FUNCTION is_scan_owned_by_current_tenant(p_scan_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM scans s
    JOIN repositories r ON r.id = s.repository_id
    WHERE s.id = p_scan_id
      AND r.tenant_id = current_tenant_id()
  );
$$ LANGUAGE SQL STABLE;

-- =============================================================================
-- Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (version) VALUES ('004_rls_policies');
