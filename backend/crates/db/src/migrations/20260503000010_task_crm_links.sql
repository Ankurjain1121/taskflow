-- Task ↔ CRM entity linking (Phase 7)
-- Bidirectional links between tasks and CRM contacts, companies, and deals.
-- Each entity is linked by (task_id, twenty_workspace_id, crm_entity_id).
-- Composite PK prevents duplicate links. RLS enforced at the task level.
--
-- FORCE ROW LEVEL SECURITY ensures the table owner (migration runner) also
-- obeys RLS policies — without it the owner bypasses them silently.
--
-- WITH CHECK on the INSERT/UPDATE path prevents a tenant writing rows that
-- point at tasks belonging to a different tenant.

CREATE TABLE task_crm_contacts (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    twenty_workspace_id TEXT NOT NULL,
    crm_contact_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (task_id, twenty_workspace_id, crm_contact_id)
);

CREATE INDEX idx_task_crm_contacts_lookup ON task_crm_contacts (twenty_workspace_id, crm_contact_id);
CREATE INDEX idx_task_crm_contacts_creator ON task_crm_contacts (created_by_id);

ALTER TABLE task_crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_crm_contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY task_crm_contacts_tenant_isolation ON task_crm_contacts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_id
              AND tasks.workspace_id::TEXT = current_setting('app.tenant_id', true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_id
              AND tasks.workspace_id::TEXT = current_setting('app.tenant_id', true)
        )
    );

CREATE TABLE task_crm_companies (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    twenty_workspace_id TEXT NOT NULL,
    crm_company_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (task_id, twenty_workspace_id, crm_company_id)
);

CREATE INDEX idx_task_crm_companies_lookup ON task_crm_companies (twenty_workspace_id, crm_company_id);
CREATE INDEX idx_task_crm_companies_creator ON task_crm_companies (created_by_id);

ALTER TABLE task_crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_crm_companies FORCE ROW LEVEL SECURITY;

CREATE POLICY task_crm_companies_tenant_isolation ON task_crm_companies
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_id
              AND tasks.workspace_id::TEXT = current_setting('app.tenant_id', true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_id
              AND tasks.workspace_id::TEXT = current_setting('app.tenant_id', true)
        )
    );

CREATE TABLE task_crm_deals (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    twenty_workspace_id TEXT NOT NULL,
    crm_deal_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (task_id, twenty_workspace_id, crm_deal_id)
);

CREATE INDEX idx_task_crm_deals_lookup ON task_crm_deals (twenty_workspace_id, crm_deal_id);
CREATE INDEX idx_task_crm_deals_creator ON task_crm_deals (created_by_id);

ALTER TABLE task_crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_crm_deals FORCE ROW LEVEL SECURITY;

CREATE POLICY task_crm_deals_tenant_isolation ON task_crm_deals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_id
              AND tasks.workspace_id::TEXT = current_setting('app.tenant_id', true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_id
              AND tasks.workspace_id::TEXT = current_setting('app.tenant_id', true)
        )
    );
