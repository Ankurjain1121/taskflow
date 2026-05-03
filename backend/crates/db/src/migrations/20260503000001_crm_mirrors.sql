-- Phase 6a: CRM mirror tables (read-only mirrors of Twenty CRM)
-- These tables are NEVER mutated by TaskBolt business logic.
-- Twenty is the source of truth; rows arrive via inbound webhook only.

-- Workspace link: maps tenant_id → Twenty workspace + HMAC secret
-- Created here so Phase 6a handler can look up the secret.
CREATE TABLE crm_workspace_links (
    tenant_id UUID NOT NULL,
    twenty_workspace_id TEXT NOT NULL,
    hmac_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id)
);
CREATE UNIQUE INDEX crm_workspace_links_workspace ON crm_workspace_links (twenty_workspace_id);

-- Contact mirror (person.* events from Twenty)
CREATE TABLE crm_contact_mirror (
    tenant_id UUID NOT NULL,
    twenty_workspace_id TEXT NOT NULL,
    twenty_id UUID NOT NULL,
    name TEXT,
    primary_email TEXT,
    primary_phone TEXT,
    owner_twenty_id TEXT,
    raw_json JSONB NOT NULL,
    parsed_projection JSONB,
    source_schema_version INT NOT NULL DEFAULT 1,
    twenty_updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (twenty_workspace_id, twenty_id),
    -- 16 KB cap per Eng Sec 7: prevents oversized payloads persisting to disk
    CONSTRAINT crm_contact_raw_json_size CHECK (octet_length(raw_json::text) <= 16384)
);
CREATE INDEX crm_contact_mirror_tenant ON crm_contact_mirror (tenant_id);
CREATE INDEX crm_contact_mirror_email   ON crm_contact_mirror (tenant_id, primary_email);
CREATE INDEX crm_contact_mirror_recent  ON crm_contact_mirror (tenant_id, twenty_updated_at DESC);

ALTER TABLE crm_contact_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_contact_mirror_tenant_iso ON crm_contact_mirror
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Company mirror (company.* events from Twenty)
CREATE TABLE crm_company_mirror (
    tenant_id UUID NOT NULL,
    twenty_workspace_id TEXT NOT NULL,
    twenty_id UUID NOT NULL,
    name TEXT,
    primary_email TEXT,
    primary_phone TEXT,
    owner_twenty_id TEXT,
    raw_json JSONB NOT NULL,
    parsed_projection JSONB,
    source_schema_version INT NOT NULL DEFAULT 1,
    twenty_updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (twenty_workspace_id, twenty_id),
    CONSTRAINT crm_company_raw_json_size CHECK (octet_length(raw_json::text) <= 16384)
);
CREATE INDEX crm_company_mirror_tenant ON crm_company_mirror (tenant_id);
CREATE INDEX crm_company_mirror_email   ON crm_company_mirror (tenant_id, primary_email);
CREATE INDEX crm_company_mirror_recent  ON crm_company_mirror (tenant_id, twenty_updated_at DESC);

ALTER TABLE crm_company_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_company_mirror_tenant_iso ON crm_company_mirror
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Deal mirror (opportunity.* events from Twenty)
-- Adds stage + amount_cents that contacts/companies do not have.
CREATE TABLE crm_deal_mirror (
    tenant_id UUID NOT NULL,
    twenty_workspace_id TEXT NOT NULL,
    twenty_id UUID NOT NULL,
    name TEXT,
    stage TEXT,
    amount_cents BIGINT,
    owner_twenty_id TEXT,
    raw_json JSONB NOT NULL,
    parsed_projection JSONB,
    source_schema_version INT NOT NULL DEFAULT 1,
    twenty_updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (twenty_workspace_id, twenty_id),
    CONSTRAINT crm_deal_raw_json_size CHECK (octet_length(raw_json::text) <= 16384)
);
CREATE INDEX crm_deal_mirror_tenant ON crm_deal_mirror (tenant_id);
CREATE INDEX crm_deal_mirror_recent  ON crm_deal_mirror (tenant_id, twenty_updated_at DESC);

ALTER TABLE crm_deal_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_deal_mirror_tenant_iso ON crm_deal_mirror
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- Webhook event log: idempotency/dedup store for inbound Twenty webhooks.
-- event_id = X-Twenty-Webhook-Nonce header (unique per delivery).
-- ON CONFLICT DO NOTHING + check rows_affected → dup detection without SELECT.
CREATE TABLE crm_webhook_event_log (
    workspace_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processed', 'failed', 'dup')),
    event_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    PRIMARY KEY (workspace_id, event_id)
);
CREATE INDEX crm_webhook_event_log_received ON crm_webhook_event_log (workspace_id, received_at DESC);
