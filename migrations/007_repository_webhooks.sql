-- =============================================================================
-- Migration 007: Repository Webhooks
-- Stores webhook registrations for push event notifications
-- TASK-INFRA-006: GitHub Adapter & Webhook Management
-- =============================================================================

-- =============================================================================
-- Repository Webhooks Table
-- =============================================================================
CREATE TABLE repository_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    repository_id VARCHAR(255) NOT NULL,
    repository_full_name VARCHAR(255) NOT NULL,
    webhook_id VARCHAR(255) NOT NULL,
    callback_url TEXT NOT NULL,
    secret_hash VARCHAR(64) NOT NULL,
    events JSONB NOT NULL DEFAULT '["push"]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Tenant-based queries
CREATE INDEX idx_webhooks_tenant ON repository_webhooks(tenant_id);

-- Repository-based queries
CREATE INDEX idx_webhooks_repo ON repository_webhooks(repository_id);

-- Unique constraint: one webhook per tenant/repo/webhook_id combination
CREATE UNIQUE INDEX idx_webhooks_unique ON repository_webhooks(tenant_id, repository_id, webhook_id);

-- Active webhooks lookup
CREATE INDEX idx_webhooks_active ON repository_webhooks(tenant_id, is_active)
    WHERE is_active = TRUE;

-- =============================================================================
-- Enable Row-Level Security
-- =============================================================================
ALTER TABLE repository_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_webhooks FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies for Repository Webhooks
-- =============================================================================

-- Policy for SELECT operations
CREATE POLICY webhooks_tenant_select ON repository_webhooks
    FOR SELECT
    USING (tenant_id = current_tenant_id());

-- Policy for INSERT operations
CREATE POLICY webhooks_tenant_insert ON repository_webhooks
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

-- Policy for UPDATE operations
CREATE POLICY webhooks_tenant_update ON repository_webhooks
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Policy for DELETE operations
CREATE POLICY webhooks_tenant_delete ON repository_webhooks
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- Updated At Trigger
-- =============================================================================
CREATE TRIGGER update_repository_webhooks_updated_at
    BEFORE UPDATE ON repository_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (version) VALUES ('007_repository_webhooks');
