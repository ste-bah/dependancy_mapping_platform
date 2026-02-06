-- =============================================================================
-- Migration 006: API Keys Table
-- Secure API key management with tenant isolation
-- TASK-INFRA-005: API Key Management
-- =============================================================================

-- =============================================================================
-- API Keys Table
-- =============================================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,  -- References users table (nullable for service accounts)
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,  -- dmp_live_ or dmp_test_
    key_hash VARCHAR(64) NOT NULL,    -- SHA-256 hash of the full key
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
    last_used_at TIMESTAMPTZ,
    request_count BIGINT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    CONSTRAINT valid_key_prefix CHECK (key_prefix IN ('dmp_live_', 'dmp_test_')),
    CONSTRAINT valid_scopes CHECK (
        scopes <@ ARRAY['read', 'write', 'admin']::TEXT[]
    )
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Fast lookup by key prefix (used during authentication)
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- Tenant-based queries
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);

-- User-based queries
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id) WHERE user_id IS NOT NULL;

-- Active keys (not revoked, not expired)
CREATE INDEX idx_api_keys_active ON api_keys(tenant_id, key_prefix)
    WHERE revoked_at IS NULL;

-- Hash lookup for validation (partial index for non-revoked keys)
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash)
    WHERE revoked_at IS NULL;

-- =============================================================================
-- Enable Row-Level Security
-- =============================================================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies for API Keys
-- =============================================================================

-- Policy for SELECT operations
CREATE POLICY api_keys_tenant_select ON api_keys
    FOR SELECT
    USING (tenant_id = current_tenant_id());

-- Policy for INSERT operations
CREATE POLICY api_keys_tenant_insert ON api_keys
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

-- Policy for UPDATE operations
CREATE POLICY api_keys_tenant_update ON api_keys
    FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Policy for DELETE operations
CREATE POLICY api_keys_tenant_delete ON api_keys
    FOR DELETE
    USING (tenant_id = current_tenant_id());

-- =============================================================================
-- Updated At Trigger
-- =============================================================================
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (version) VALUES ('006_api_keys');
