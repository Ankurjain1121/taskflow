-- CRM workspace links: bind a TaskBolt tenant to a Twenty CRM workspace.
-- Stores Twenty's OIDC client credentials + (optional) API key for server-to-server provisioning.
-- Encrypted blobs are wrapped client-side via AES-256-GCM (HKDF-from-JWT_SECRET).

CREATE TABLE crm_workspace_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twenty_workspace_id TEXT NOT NULL,
    twenty_api_key_encrypted BYTEA,
    twenty_oidc_client_id TEXT NOT NULL,
    twenty_oidc_client_secret_encrypted BYTEA NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id UUID NOT NULL REFERENCES users(id)
);

-- Only one active (non-expired) link per tenant.
CREATE UNIQUE INDEX crm_workspace_links_tenant_active
    ON crm_workspace_links (tenant_id)
    WHERE valid_to IS NULL;

-- Lookup by twenty_workspace_id (used by OIDC token endpoint to resolve back to a tenant link).
CREATE INDEX crm_workspace_links_twenty_workspace_id
    ON crm_workspace_links (twenty_workspace_id);

ALTER TABLE crm_workspace_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_workspace_links FORCE ROW LEVEL SECURITY;

CREATE POLICY crm_workspace_links_tenant_isolation ON crm_workspace_links
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);
