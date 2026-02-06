-- =============================================================================
-- Dependency Mapping Platform - PostgreSQL Initialization
-- TASK-DEV-002: Configure extensions for full-text search and time-series
-- =============================================================================

-- Enable extensions in the default postgres database first
-- pg_search is auto-enabled in ParadeDB image
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Note: TimescaleDB requires shared_preload_libraries configuration
-- ParadeDB may not include TimescaleDB by default - check availability
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
        CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
        RAISE NOTICE 'TimescaleDB extension enabled';
    ELSE
        RAISE NOTICE 'TimescaleDB not available in this image - skipping';
    END IF;
END
$$;

-- Verify pg_search is available (built into ParadeDB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_search') THEN
        CREATE EXTENSION IF NOT EXISTS pg_search;
        RAISE NOTICE 'pg_search extension enabled';
    ELSE
        RAISE NOTICE 'pg_search not available - ensure using ParadeDB image';
    END IF;
END
$$;

-- =============================================================================
-- Application Database Setup
-- =============================================================================

-- Connect to application database (created via POSTGRES_DB env var)
\connect dmp_dev;

-- Re-enable extensions in application database
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
        CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_search') THEN
        CREATE EXTENSION IF NOT EXISTS pg_search;
    END IF;
END
$$;

-- =============================================================================
-- Verification Query (for debugging)
-- =============================================================================
DO $$
DECLARE
    ext_record RECORD;
BEGIN
    RAISE NOTICE '=== Installed Extensions ===';
    FOR ext_record IN SELECT extname, extversion FROM pg_extension ORDER BY extname
    LOOP
        RAISE NOTICE 'Extension: % (version %)', ext_record.extname, ext_record.extversion;
    END LOOP;
END
$$;
