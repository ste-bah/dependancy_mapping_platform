-- =============================================================================
-- Migration 005: Application Roles and Permissions
-- Role-based access control for the application
-- TASK-INFRA-002: Row-Level Security (RLS) Policies
-- =============================================================================

-- =============================================================================
-- Application Role (for API server connections)
-- =============================================================================

-- Drop existing role if exists (for idempotency)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dmp_app') THEN
    -- Revoke all existing grants
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dmp_app;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM dmp_app;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM dmp_app;
    REVOKE USAGE ON SCHEMA public FROM dmp_app;
  END IF;
END
$$;

-- Create or update application role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dmp_app') THEN
    CREATE ROLE dmp_app LOGIN PASSWORD 'app_secure_password_change_me';
  END IF;
END
$$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO dmp_app;

-- Grant table permissions
-- Tenants: Read-only (tenant ID comes from JWT, not direct queries)
GRANT SELECT ON tenants TO dmp_app;

-- Full CRUD on tenant-scoped tables (RLS will enforce isolation)
GRANT SELECT, INSERT, UPDATE, DELETE ON repositories TO dmp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON scans TO dmp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON nodes TO dmp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON edges TO dmp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON external_objects TO dmp_app;

-- Read-only on migration tracking
GRANT SELECT ON schema_migrations TO dmp_app;

-- Grant sequence permissions for UUID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dmp_app;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION current_tenant_id() TO dmp_app;
GRANT EXECUTE ON FUNCTION set_tenant_id(UUID) TO dmp_app;
GRANT EXECUTE ON FUNCTION set_tenant_id_validated(UUID) TO dmp_app;
GRANT EXECUTE ON FUNCTION search_nodes(UUID, TEXT, INTEGER, FLOAT) TO dmp_app;
GRANT EXECUTE ON FUNCTION fulltext_search_nodes(UUID, TEXT, INTEGER) TO dmp_app;
GRANT EXECUTE ON FUNCTION get_scan_history(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO dmp_app;
GRANT EXECUTE ON FUNCTION get_repository_trends(UUID, TEXT, INTEGER) TO dmp_app;
GRANT EXECUTE ON FUNCTION is_scan_owned_by_current_tenant(UUID) TO dmp_app;

-- =============================================================================
-- Admin Role (bypasses RLS for management operations)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dmp_admin') THEN
    CREATE ROLE dmp_admin LOGIN PASSWORD 'admin_secure_password_change_me';
  END IF;
END
$$;

-- Admin has superuser-like access but not actual superuser
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dmp_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dmp_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO dmp_admin;
GRANT USAGE ON SCHEMA public TO dmp_admin;

-- Admin can bypass RLS (important: use this carefully)
ALTER ROLE dmp_admin BYPASSRLS;

-- Grant admin the ability to set tenant context
GRANT EXECUTE ON FUNCTION clear_tenant_context() TO dmp_admin;

-- =============================================================================
-- Service Role (for background jobs, cron, migrations)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dmp_service') THEN
    CREATE ROLE dmp_service LOGIN PASSWORD 'service_secure_password_change_me';
  END IF;
END
$$;

-- Service role has full access and bypasses RLS
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dmp_service;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dmp_service;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO dmp_service;
GRANT USAGE ON SCHEMA public TO dmp_service;
ALTER ROLE dmp_service BYPASSRLS;

-- =============================================================================
-- Read-Only Role (for analytics, reporting)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dmp_readonly') THEN
    CREATE ROLE dmp_readonly LOGIN PASSWORD 'readonly_secure_password_change_me';
  END IF;
END
$$;

-- Read-only access to all tables (still subject to RLS)
GRANT USAGE ON SCHEMA public TO dmp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dmp_readonly;

-- Grant execute on read functions only
GRANT EXECUTE ON FUNCTION current_tenant_id() TO dmp_readonly;
GRANT EXECUTE ON FUNCTION search_nodes(UUID, TEXT, INTEGER, FLOAT) TO dmp_readonly;
GRANT EXECUTE ON FUNCTION fulltext_search_nodes(UUID, TEXT, INTEGER) TO dmp_readonly;
GRANT EXECUTE ON FUNCTION get_scan_history(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO dmp_readonly;
GRANT EXECUTE ON FUNCTION get_repository_trends(UUID, TEXT, INTEGER) TO dmp_readonly;

-- =============================================================================
-- Default Privileges for Future Objects
-- =============================================================================

-- Ensure new tables get proper grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO dmp_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dmp_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO dmp_admin, dmp_service;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO dmp_app, dmp_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO dmp_admin, dmp_service;

-- =============================================================================
-- Role Documentation
-- =============================================================================
COMMENT ON ROLE dmp_app IS 'Application role for API server - subject to RLS';
COMMENT ON ROLE dmp_admin IS 'Admin role for management - bypasses RLS';
COMMENT ON ROLE dmp_service IS 'Service role for background jobs - bypasses RLS';
COMMENT ON ROLE dmp_readonly IS 'Read-only role for analytics - subject to RLS';

-- =============================================================================
-- Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (version) VALUES ('005_application_roles');
