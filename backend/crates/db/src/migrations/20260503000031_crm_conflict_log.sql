-- Phase 6c: conflict log.
-- When the outbound sync drops an update because Twenty's mirror is newer,
-- we record what we threw away (per-field) so a tenant admin can audit.
--
-- resolution values:
--   'twenty_wins_timestamp' — local_updated_at <= twenty_updated_at, drop outbound (default)
--   'twenty_wins_tie'       — equal-second tiebreaker (Twenty wins per Eng review)
--   'manual'                — admin overrode the auto-decision
--
-- RLS: same FORCE pattern as crm_sync_jobs.

CREATE TABLE crm_conflict_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twenty_workspace_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
    entity_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    taskbolt_value JSONB,
    twenty_value JSONB,
    resolution TEXT NOT NULL
        CHECK (resolution IN ('twenty_wins_timestamp', 'twenty_wins_tie', 'manual')),
    -- Local timestamp on the outbound payload at decision time.
    taskbolt_updated_at TIMESTAMPTZ,
    -- Mirror's twenty_updated_at at decision time.
    twenty_updated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- NULL when auto-resolved by the worker; user_id when an admin manually overrode.
    resolved_by UUID,
    -- Reference back to the dropped outbound job (NULL if direct write).
    source_job_id UUID
);

CREATE INDEX crm_conflict_log_tenant ON crm_conflict_log (tenant_id, resolved_at DESC);
CREATE INDEX crm_conflict_log_entity ON crm_conflict_log (tenant_id, entity_type, entity_id);

ALTER TABLE crm_conflict_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conflict_log FORCE ROW LEVEL SECURITY;

CREATE POLICY crm_conflict_log_tenant_iso ON crm_conflict_log
    FOR ALL
    USING (
        tenant_id = current_setting('app.tenant_id', true)::UUID
        OR current_setting('app.bypass_rls', true) = 'true'
    );
