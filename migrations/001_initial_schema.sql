-- =============================================================================
-- Migration 001: Initial Schema
-- Dependency Mapping Platform - Core Tables
-- TASK-INFRA-001: Database Schema Design
-- =============================================================================

-- Enable required extensions (pg_trgm already enabled in init.sql)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Tenants Table (Multi-tenancy isolation)
-- =============================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);

COMMENT ON TABLE tenants IS 'Organization/workspace isolation for multi-tenancy';

-- =============================================================================
-- Repositories Table
-- =============================================================================
CREATE TYPE git_provider AS ENUM ('github', 'gitlab', 'bitbucket', 'azure_devops');

CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider git_provider NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    default_branch VARCHAR(255) DEFAULT 'main',
    clone_url TEXT NOT NULL,
    webhook_secret TEXT,
    last_scan_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_repo_tenant_provider_owner_name
        UNIQUE (tenant_id, provider, owner, name)
);

CREATE INDEX idx_repositories_tenant ON repositories(tenant_id);
CREATE INDEX idx_repositories_provider ON repositories(provider);
CREATE INDEX idx_repositories_last_scan ON repositories(last_scan_at DESC NULLS LAST);

COMMENT ON TABLE repositories IS 'Git repositories being tracked for dependency analysis';

-- =============================================================================
-- Scans Table (will be converted to TimescaleDB hypertable in migration 003)
-- =============================================================================
CREATE TYPE scan_status AS ENUM (
    'pending',
    'cloning',
    'analyzing',
    'indexing',
    'completed',
    'failed',
    'cancelled'
);

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    commit_sha VARCHAR(40) NOT NULL,
    branch VARCHAR(255),
    status scan_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    error_message TEXT,
    scan_config JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scans_repository ON scans(repository_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_scans_started_at ON scans(started_at DESC);
CREATE INDEX idx_scans_commit ON scans(repository_id, commit_sha);

COMMENT ON TABLE scans IS 'Repository scan executions - converted to TimescaleDB hypertable';

-- =============================================================================
-- Node Types (dependency graph vertices)
-- =============================================================================
CREATE TYPE node_type AS ENUM (
    -- Terraform
    'tf_resource',
    'tf_data_source',
    'tf_module',
    'tf_variable',
    'tf_output',
    'tf_provider',
    'tf_local',

    -- Helm
    'helm_chart',
    'helm_template',
    'helm_values',
    'helm_dependency',

    -- Terragrunt
    'tg_module',
    'tg_dependency',
    'tg_include',

    -- Generic
    'file',
    'external_reference'
);

-- =============================================================================
-- Nodes Table (graph vertices)
-- =============================================================================
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    type node_type NOT NULL,
    name VARCHAR(500) NOT NULL,
    qualified_name VARCHAR(1000),
    file_path VARCHAR(1000) NOT NULL,
    line_start INTEGER,
    line_end INTEGER,
    content_hash VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nodes_scan ON nodes(scan_id);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_file_path ON nodes(file_path);
CREATE INDEX idx_nodes_scan_type ON nodes(scan_id, type);

COMMENT ON TABLE nodes IS 'Dependency graph vertices (resources, modules, etc.)';

-- =============================================================================
-- Edge Types (dependency relationships)
-- =============================================================================
CREATE TYPE edge_type AS ENUM (
    'depends_on',       -- Explicit dependency
    'references',       -- Variable/output reference
    'imports',          -- Module import
    'provides',         -- Provider dependency
    'inherits',         -- Terragrunt inheritance
    'overrides',        -- Value override
    'calls',            -- Function/module call
    'contains'          -- Parent-child containment
);

-- =============================================================================
-- Edges Table (graph relationships)
-- =============================================================================
CREATE TABLE edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    type edge_type NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
    evidence JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_edge_scan_source_target_type
        UNIQUE (scan_id, source_node_id, target_node_id, type)
);

CREATE INDEX idx_edges_scan ON edges(scan_id);
CREATE INDEX idx_edges_source ON edges(source_node_id);
CREATE INDEX idx_edges_target ON edges(target_node_id);
CREATE INDEX idx_edges_scan_source ON edges(scan_id, source_node_id);
CREATE INDEX idx_edges_scan_target ON edges(scan_id, target_node_id);
CREATE INDEX idx_edges_type ON edges(type);

COMMENT ON TABLE edges IS 'Dependency graph edges (relationships between nodes)';

-- =============================================================================
-- External Objects (cross-repository references)
-- =============================================================================
CREATE TABLE external_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    identifier VARCHAR(500) NOT NULL,
    provider VARCHAR(100),
    first_seen_scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    reference_count INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_external_tenant_type_identifier
        UNIQUE (tenant_id, type, identifier)
);

CREATE INDEX idx_external_tenant ON external_objects(tenant_id);
CREATE INDEX idx_external_type ON external_objects(type);
CREATE INDEX idx_external_identifier ON external_objects(identifier);

COMMENT ON TABLE external_objects IS 'External resources referenced across repositories';

-- =============================================================================
-- Updated At Trigger Function
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scans_updated_at
    BEFORE UPDATE ON scans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at
    BEFORE UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_objects_updated_at
    BEFORE UPDATE ON external_objects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Migration Tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');
