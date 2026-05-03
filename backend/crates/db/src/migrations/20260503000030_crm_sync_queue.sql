-- Phase 6b: outbound CRM sync queue + DLQ.
-- Worker pops jobs, calls Twenty REST upsert/delete, retries with exponential backoff,
-- moves exhausted jobs to crm_sync_dlq for admin review.
--
-- Idempotency: idempotency_key UNIQUE prevents duplicate enqueues; same input → same row.
-- Twenty REST 409 (already exists) is treated as success at the worker layer.
--
-- RLS: FORCE-enabled. The enqueue API sets app.tenant_id; the background worker sets
-- app.bypass_rls = 'true' inside its claim transaction so it can scan across tenants.
-- (Both `current_setting(..., true)` calls return NULL when unset → policy denies.)

CREATE TABLE crm_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twenty_workspace_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    payload JSONB NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'claimed', 'succeeded', 'failed', 'dlq', 'dropped_conflict')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    last_error TEXT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    -- Drives the picker: set to now() on insert, advanced by exponential backoff on retry.
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Cap payload at 16 KB (matches W5 mirror cap; prevents oversized rows).
    CONSTRAINT crm_sync_jobs_payload_size CHECK (octet_length(payload::text) <= 16384)
);

-- Picker index: status + scheduling key.
CREATE INDEX crm_sync_jobs_picker
    ON crm_sync_jobs (status, next_attempt_at)
    WHERE status IN ('pending', 'failed');

-- Idempotency lookup index (UNIQUE constraint already gives us this, but explicit is clearer).
CREATE INDEX crm_sync_jobs_idem ON crm_sync_jobs (idempotency_key);

-- Tenant scan: admin UI lists jobs for a workspace.
CREATE INDEX crm_sync_jobs_tenant ON crm_sync_jobs (tenant_id, queued_at DESC);

ALTER TABLE crm_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY crm_sync_jobs_tenant_iso ON crm_sync_jobs
    FOR ALL
    USING (
        tenant_id = current_setting('app.tenant_id', true)::UUID
        OR current_setting('app.bypass_rls', true) = 'true'
    );

-- Dead-letter queue. Jobs that exhausted max_retries land here; admin UI can
-- requeue or discard them. Same shape as crm_sync_jobs + DLQ-specific cols.
CREATE TABLE crm_sync_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_job_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twenty_workspace_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key TEXT NOT NULL,
    retry_count INT NOT NULL,
    last_error TEXT,
    dlq_reason TEXT NOT NULL,
    queued_at TIMESTAMPTZ NOT NULL,
    moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_sync_dlq_payload_size CHECK (octet_length(payload::text) <= 16384)
);

CREATE INDEX crm_sync_dlq_tenant ON crm_sync_dlq (tenant_id, moved_at DESC);
CREATE INDEX crm_sync_dlq_idem ON crm_sync_dlq (idempotency_key);

ALTER TABLE crm_sync_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_dlq FORCE ROW LEVEL SECURITY;

CREATE POLICY crm_sync_dlq_tenant_iso ON crm_sync_dlq
    FOR ALL
    USING (
        tenant_id = current_setting('app.tenant_id', true)::UUID
        OR current_setting('app.bypass_rls', true) = 'true'
    );
