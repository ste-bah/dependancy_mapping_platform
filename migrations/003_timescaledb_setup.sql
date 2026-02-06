-- =============================================================================
-- Migration 003: TimescaleDB Setup
-- Convert scans table to hypertable for time-series optimization
-- TASK-INFRA-001: Database Schema Design
-- =============================================================================

-- =============================================================================
-- TimescaleDB Hypertable Configuration
-- =============================================================================

DO $$
BEGIN
    -- Check if TimescaleDB is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN

        -- Convert scans table to hypertable
        -- Chunks by started_at with 7-day intervals
        PERFORM create_hypertable(
            'scans',
            'started_at',
            chunk_time_interval => INTERVAL '7 days',
            if_not_exists => TRUE,
            migrate_data => TRUE
        );

        RAISE NOTICE 'Scans table converted to TimescaleDB hypertable';

        -- Enable compression for older chunks
        ALTER TABLE scans SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'repository_id',
            timescaledb.compress_orderby = 'started_at DESC'
        );

        -- Create compression policy - compress chunks older than 30 days
        PERFORM add_compression_policy('scans', INTERVAL '30 days', if_not_exists => TRUE);

        RAISE NOTICE 'Compression policy added for scans table';

        -- Create retention policy - keep data for 1 year
        -- Uncomment if automatic deletion is desired:
        -- PERFORM add_retention_policy('scans', INTERVAL '1 year', if_not_exists => TRUE);

    ELSE
        RAISE NOTICE 'TimescaleDB not available - scans remains a regular table';
        RAISE NOTICE 'Time-series optimizations will not be applied';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB setup failed: %. Continuing with regular table.', SQLERRM;
END
$$;

-- =============================================================================
-- Create Continuous Aggregates for Dashboard Metrics
-- (Only if TimescaleDB is available)
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN

        -- Daily scan statistics materialized view
        CREATE MATERIALIZED VIEW IF NOT EXISTS scan_stats_daily
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('1 day', started_at) AS bucket,
            repository_id,
            COUNT(*) AS scan_count,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
            AVG(node_count)::INTEGER AS avg_nodes,
            AVG(edge_count)::INTEGER AS avg_edges,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::INTEGER AS avg_duration_seconds
        FROM scans
        WHERE completed_at IS NOT NULL
        GROUP BY bucket, repository_id
        WITH NO DATA;

        -- Refresh policy for continuous aggregate
        PERFORM add_continuous_aggregate_policy(
            'scan_stats_daily',
            start_offset => INTERVAL '3 days',
            end_offset => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour',
            if_not_exists => TRUE
        );

        RAISE NOTICE 'Continuous aggregate scan_stats_daily created';

        -- Hourly scan statistics for recent activity
        CREATE MATERIALIZED VIEW IF NOT EXISTS scan_stats_hourly
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('1 hour', started_at) AS bucket,
            repository_id,
            COUNT(*) AS scan_count,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
        FROM scans
        GROUP BY bucket, repository_id
        WITH NO DATA;

        PERFORM add_continuous_aggregate_policy(
            'scan_stats_hourly',
            start_offset => INTERVAL '2 hours',
            end_offset => INTERVAL '5 minutes',
            schedule_interval => INTERVAL '5 minutes',
            if_not_exists => TRUE
        );

        RAISE NOTICE 'Continuous aggregate scan_stats_hourly created';

    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Continuous aggregate creation failed: %. This is non-critical.', SQLERRM;
END
$$;

-- =============================================================================
-- Helper Functions for Time-Series Queries
-- =============================================================================

-- Get scan history for a repository within a time range
CREATE OR REPLACE FUNCTION get_scan_history(
    p_repository_id UUID,
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    scan_id UUID,
    commit_sha VARCHAR,
    status scan_status,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    node_count INTEGER,
    edge_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.commit_sha,
        s.status,
        s.started_at,
        s.completed_at,
        EXTRACT(EPOCH FROM (s.completed_at - s.started_at))::INTEGER,
        s.node_count,
        s.edge_count
    FROM scans s
    WHERE s.repository_id = p_repository_id
      AND s.started_at >= p_start_time
      AND s.started_at <= p_end_time
    ORDER BY s.started_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get repository scan trends
CREATE OR REPLACE FUNCTION get_repository_trends(
    p_repository_id UUID,
    p_interval TEXT DEFAULT '1 day',
    p_periods INTEGER DEFAULT 30
)
RETURNS TABLE (
    period TIMESTAMPTZ,
    scan_count BIGINT,
    success_rate NUMERIC,
    avg_nodes INTEGER,
    avg_edges INTEGER
) AS $$
BEGIN
    RETURN QUERY
    EXECUTE format(
        'SELECT
            time_bucket(%L::INTERVAL, started_at) AS period,
            COUNT(*) AS scan_count,
            ROUND(100.0 * SUM(CASE WHEN status = ''completed'' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS success_rate,
            AVG(node_count)::INTEGER AS avg_nodes,
            AVG(edge_count)::INTEGER AS avg_edges
        FROM scans
        WHERE repository_id = %L
          AND started_at >= NOW() - (%L::INTERVAL * %s)
        GROUP BY period
        ORDER BY period DESC',
        p_interval, p_repository_id, p_interval, p_periods
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback for non-TimescaleDB (use date_trunc instead of time_bucket)
        RETURN QUERY
        EXECUTE format(
            'SELECT
                date_trunc(''day'', started_at) AS period,
                COUNT(*) AS scan_count,
                ROUND(100.0 * SUM(CASE WHEN status = ''completed'' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS success_rate,
                AVG(node_count)::INTEGER AS avg_nodes,
                AVG(edge_count)::INTEGER AS avg_edges
            FROM scans
            WHERE repository_id = %L
              AND started_at >= NOW() - INTERVAL ''%s days''
            GROUP BY period
            ORDER BY period DESC',
            p_repository_id, p_periods
        );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (version) VALUES ('003_timescaledb_setup');
