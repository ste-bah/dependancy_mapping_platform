-- =============================================================================
-- Migration 002: Search Indexes
-- BM25 Full-Text Search and Trigram Fuzzy Matching
-- TASK-INFRA-001: Database Schema Design
-- =============================================================================

-- Ensure pg_trgm is available (should be from init.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- Trigram Indexes for Fuzzy Matching
-- Supports LIKE, ILIKE, and similarity queries
-- =============================================================================

-- Trigram index on node names for fuzzy search
CREATE INDEX idx_nodes_name_trgm ON nodes
    USING GIN (name gin_trgm_ops);

-- Trigram index on file paths for fuzzy file search
CREATE INDEX idx_nodes_file_path_trgm ON nodes
    USING GIN (file_path gin_trgm_ops);

-- Trigram index on qualified names
CREATE INDEX idx_nodes_qualified_name_trgm ON nodes
    USING GIN (qualified_name gin_trgm_ops);

-- Trigram index on repository names
CREATE INDEX idx_repositories_name_trgm ON repositories
    USING GIN (name gin_trgm_ops);

-- Trigram index on external object identifiers
CREATE INDEX idx_external_identifier_trgm ON external_objects
    USING GIN (identifier gin_trgm_ops);

-- =============================================================================
-- BM25 Full-Text Search Indexes (using pg_search)
-- Provides relevance-ranked search results
-- =============================================================================

-- Check if pg_search is available and create BM25 index
DO $$
BEGIN
    -- Check if pg_search extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_search') THEN
        -- Create BM25 index on nodes for full-text search
        -- This enables: SELECT * FROM nodes WHERE name @@@ 'search_term'
        EXECUTE '
            CREATE INDEX idx_nodes_name_bm25 ON nodes
            USING bm25 (id, name, file_path, qualified_name)
            WITH (
                key_field = ''id'',
                text_fields = ''{"name": {"tokenizer": {"type": "default"}}, "file_path": {"tokenizer": {"type": "default"}}, "qualified_name": {"tokenizer": {"type": "default"}}}''
            )
        ';
        RAISE NOTICE 'BM25 index created on nodes table';
    ELSE
        RAISE NOTICE 'pg_search not available - BM25 indexes skipped (using trigram fallback)';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'BM25 index creation failed: %. Using trigram indexes as fallback.', SQLERRM;
END
$$;

-- =============================================================================
-- Standard Full-Text Search (PostgreSQL native - fallback)
-- Uses tsvector for GIN-based text search
-- =============================================================================

-- Add tsvector columns for native PostgreSQL full-text search
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION nodes_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.qualified_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.file_path, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector
CREATE TRIGGER nodes_search_vector_trigger
    BEFORE INSERT OR UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION nodes_search_vector_update();

-- GIN index on search vector for fast full-text search
CREATE INDEX idx_nodes_search_vector ON nodes USING GIN (search_vector);

-- =============================================================================
-- Similarity Search Functions
-- =============================================================================

-- Function to search nodes with fuzzy matching
CREATE OR REPLACE FUNCTION search_nodes(
    p_scan_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 50,
    p_min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR,
    node_type node_type,
    file_path VARCHAR,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        n.name,
        n.type,
        n.file_path,
        GREATEST(
            similarity(n.name, p_query),
            similarity(COALESCE(n.qualified_name, ''), p_query)
        ) AS sim
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND (
          n.name % p_query
          OR n.qualified_name % p_query
          OR n.file_path % p_query
      )
    ORDER BY sim DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to perform full-text search on nodes
CREATE OR REPLACE FUNCTION fulltext_search_nodes(
    p_scan_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR,
    node_type node_type,
    file_path VARCHAR,
    rank FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        n.name,
        n.type,
        n.file_path,
        ts_rank(n.search_vector, plainto_tsquery('english', p_query)) AS rnk
    FROM nodes n
    WHERE n.scan_id = p_scan_id
      AND n.search_vector @@ plainto_tsquery('english', p_query)
    ORDER BY rnk DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Set similarity threshold for trigram operations
-- =============================================================================
-- Lower threshold = more fuzzy matches, higher = stricter
SELECT set_limit(0.3);

-- =============================================================================
-- Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (version) VALUES ('002_search_indexes');
