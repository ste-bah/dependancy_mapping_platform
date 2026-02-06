-- ============================================================================
-- Performance Optimization: Database Indexes
-- ============================================================================
-- TASK-DETECT: Performance optimization implementation
--
-- This file contains optimized indexes for the IaC Dependency Detection system.
-- Run these migrations to improve query performance for graph operations.
-- ============================================================================

-- ============================================================================
-- Nodes Table Indexes
-- ============================================================================

-- Primary access pattern: Find nodes by scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_scan_id
ON nodes (scan_id);

-- Composite index for tenant-scoped scan queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_scan_tenant
ON nodes (scan_id, tenant_id);

-- Index for node type filtering (common filter in graph queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_type
ON nodes (node_type);

-- Composite index for type filtering within a scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_scan_type
ON nodes (scan_id, tenant_id, node_type);

-- Index for file path searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_file_path
ON nodes (file_path);

-- Composite index for file-based queries within a scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_scan_file
ON nodes (scan_id, tenant_id, file_path);

-- Index for original_id lookups (used in ID mapping)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_original_id
ON nodes (scan_id, tenant_id, original_id);

-- GIN index for metadata JSONB queries (if needed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_metadata
ON nodes USING GIN (metadata);

-- Index for name searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_name
ON nodes (name);

-- Partial index for specific node types (resources are most common)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_resources
ON nodes (scan_id, tenant_id)
WHERE node_type = 'resource';

-- ============================================================================
-- Edges Table Indexes
-- ============================================================================

-- Primary access pattern: Find edges by scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_scan_id
ON edges (scan_id);

-- Composite index for tenant-scoped scan queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_scan_tenant
ON edges (scan_id, tenant_id);

-- Critical index for graph traversal: source node lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_source
ON edges (source_node_id);

-- Critical index for graph traversal: target node lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_target
ON edges (target_node_id);

-- Composite index for downstream dependency queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_source_scan
ON edges (source_node_id, scan_id, tenant_id);

-- Composite index for upstream dependency queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_target_scan
ON edges (target_node_id, scan_id, tenant_id);

-- Index for edge type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_type
ON edges (edge_type);

-- Composite index for type filtering within a scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_scan_type
ON edges (scan_id, tenant_id, edge_type);

-- Index for confidence-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_confidence
ON edges (confidence DESC);

-- Composite index for confidence filtering within a scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_scan_confidence
ON edges (scan_id, tenant_id, confidence DESC);

-- Index for implicit edge filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_implicit
ON edges (is_implicit)
WHERE is_implicit = true;

-- Index for original_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_original_id
ON edges (scan_id, tenant_id, original_id);

-- GIN index for metadata JSONB queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_metadata
ON edges USING GIN (metadata);

-- Covering index for edge lookups (includes commonly needed columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_covering
ON edges (source_node_id, target_node_id, edge_type)
INCLUDE (id, confidence, is_implicit);

-- ============================================================================
-- Scans Table Indexes
-- ============================================================================

-- Index for tenant-based scan listing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_tenant
ON scans (tenant_id);

-- Index for status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_status
ON scans (status);

-- Composite index for tenant + status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_tenant_status
ON scans (tenant_id, status);

-- Index for repository filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_repository
ON scans (repository_id);

-- Index for branch filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_branch
ON scans (branch);

-- Index for date-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_created_at
ON scans (created_at DESC);

-- Composite index for tenant + date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_tenant_created
ON scans (tenant_id, created_at DESC);

-- ============================================================================
-- Evidence Table Indexes
-- ============================================================================

-- Index for scan-based evidence queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_scan
ON evidence (scan_id, tenant_id);

-- Index for edge-based evidence lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_edge
ON evidence (edge_id);

-- Index for evidence type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_type
ON evidence (evidence_type);

-- ============================================================================
-- Query-Specific Composite Indexes
-- ============================================================================

-- Optimized index for graph statistics query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_stats
ON edges (scan_id, tenant_id)
INCLUDE (source_node_id, edge_type);

-- Optimized index for cycle detection query (used in recursive CTE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_traversal
ON edges (source_node_id, target_node_id)
WHERE scan_id IS NOT NULL;

-- Optimized index for impact analysis queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_impact
ON edges (target_node_id, scan_id, tenant_id)
INCLUDE (source_node_id, id);

-- ============================================================================
-- Partial Indexes for Common Filters
-- ============================================================================

-- Index for high-confidence edges only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_high_confidence
ON edges (scan_id, tenant_id, source_node_id, target_node_id)
WHERE confidence >= 80;

-- Index for explicit (non-implicit) edges
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_explicit
ON edges (scan_id, tenant_id)
WHERE is_implicit = false;

-- ============================================================================
-- Expression Index for Case-Insensitive Searches
-- ============================================================================

-- Index for case-insensitive name searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_name_lower
ON nodes (LOWER(name));

-- Index for case-insensitive file path searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_file_path_lower
ON nodes (LOWER(file_path));

-- ============================================================================
-- Statistics and Maintenance
-- ============================================================================

-- Update statistics for query planner
ANALYZE nodes;
ANALYZE edges;
ANALYZE scans;
ANALYZE evidence;

-- ============================================================================
-- Index Verification Query
-- ============================================================================
-- Run this to verify all indexes were created:
/*
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('nodes', 'edges', 'scans', 'evidence')
ORDER BY tablename, indexname;
*/

-- ============================================================================
-- Index Usage Monitoring Query
-- ============================================================================
-- Run this periodically to check index usage:
/*
SELECT
    schemaname,
    relname,
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname IN ('nodes', 'edges', 'scans', 'evidence')
ORDER BY idx_scan DESC;
*/

-- ============================================================================
-- Unused Index Detection Query
-- ============================================================================
-- Run this to find potentially unused indexes:
/*
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    idx_scan as index_scans
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE NOT indisunique
    AND idx_scan < 50
    AND pg_relation_size(relid) > 5 * 8192
    AND schemaname = 'public'
ORDER BY pg_relation_size(i.indexrelid) / nullif(idx_scan, 0) DESC NULLS FIRST,
         pg_relation_size(i.indexrelid) DESC;
*/
