-- Blueprint: allowed transitions per status
-- NULL = allow all (backward compat), {} = terminal status (no outgoing)
ALTER TABLE project_statuses ADD COLUMN allowed_transitions UUID[];

-- Billing: billable flag on time entries
ALTER TABLE time_entries ADD COLUMN is_billable BOOLEAN NOT NULL DEFAULT false;

-- Billing: rate per project member
ALTER TABLE project_members ADD COLUMN billing_rate_cents INTEGER;

-- Performance: index for date-range time reports
CREATE INDEX idx_time_entries_project_started ON time_entries(project_id, started_at);
