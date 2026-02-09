-- Phase 3: Productivity Features
-- Recurring Tasks, Custom Fields, Time Tracking

-- ============================================
-- Recurring Tasks
-- ============================================
CREATE TYPE recurrence_pattern AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'custom');

CREATE TABLE recurring_task_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    pattern recurrence_pattern NOT NULL,
    cron_expression VARCHAR(100),
    interval_days INTEGER,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_occurrences INTEGER,
    occurrences_created INTEGER NOT NULL DEFAULT 0,
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_configs_next_run ON recurring_task_configs(next_run_at) WHERE is_active = true;
CREATE INDEX idx_recurring_configs_task ON recurring_task_configs(task_id);
CREATE TRIGGER update_recurring_configs_updated_at BEFORE UPDATE ON recurring_task_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Custom Fields
-- ============================================
CREATE TYPE custom_field_type AS ENUM ('text', 'number', 'date', 'dropdown', 'checkbox');

CREATE TABLE board_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    field_type custom_field_type NOT NULL,
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(board_id, name)
);
CREATE INDEX idx_custom_fields_board ON board_custom_fields(board_id);
CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON board_custom_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE task_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES board_custom_fields(id) ON DELETE CASCADE,
    value_text TEXT,
    value_number DOUBLE PRECISION,
    value_date TIMESTAMPTZ,
    value_bool BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(task_id, field_id)
);
CREATE INDEX idx_custom_field_values_task ON task_custom_field_values(task_id);
CREATE INDEX idx_custom_field_values_field ON task_custom_field_values(field_id);
CREATE TRIGGER update_custom_field_values_updated_at BEFORE UPDATE ON task_custom_field_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Time Tracking
-- ============================================
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    description TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    is_running BOOLEAN NOT NULL DEFAULT false,
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_running ON time_entries(user_id, is_running) WHERE is_running = true;
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
