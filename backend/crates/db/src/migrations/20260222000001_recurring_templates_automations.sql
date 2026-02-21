-- ============================================
-- Phase 2C: Enhanced Recurring Tasks
-- ============================================

-- Add new recurrence patterns
ALTER TYPE recurrence_pattern ADD VALUE IF NOT EXISTS 'yearly';
ALTER TYPE recurrence_pattern ADD VALUE IF NOT EXISTS 'weekdays';
ALTER TYPE recurrence_pattern ADD VALUE IF NOT EXISTS 'custom_weekly';

-- Add new columns to recurring_task_configs
ALTER TABLE recurring_task_configs
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS skip_weekends BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS days_of_week INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS day_of_month INTEGER,
    ADD COLUMN IF NOT EXISTS creation_mode VARCHAR(20) NOT NULL DEFAULT 'on_schedule';

-- ============================================
-- Phase 3A: Task Templates
-- ============================================

CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scope VARCHAR(20) NOT NULL DEFAULT 'workspace',
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    task_title VARCHAR(500) NOT NULL,
    task_description TEXT,
    task_priority VARCHAR(20) DEFAULT 'medium',
    task_estimated_hours NUMERIC(8,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_templates_tenant ON task_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_board ON task_templates(board_id) WHERE board_id IS NOT NULL;
CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON task_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS task_template_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_task_template_subtasks_template ON task_template_subtasks(template_id);

CREATE TABLE IF NOT EXISTS task_template_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    UNIQUE(template_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_task_template_labels_template ON task_template_labels(template_id);

CREATE TABLE IF NOT EXISTS task_template_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES board_custom_fields(id) ON DELETE CASCADE,
    value TEXT,
    UNIQUE(template_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_task_template_custom_fields_template ON task_template_custom_fields(template_id);

-- ============================================
-- Phase 4A: New Automation Triggers
-- ============================================

ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'subtask_completed';
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'comment_added';
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'custom_field_changed';
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'label_changed';
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'due_date_approaching';

-- ============================================
-- Phase 4B: New Automation Actions
-- ============================================

ALTER TYPE automation_action_type ADD VALUE IF NOT EXISTS 'create_subtask';
ALTER TYPE automation_action_type ADD VALUE IF NOT EXISTS 'add_comment';
ALTER TYPE automation_action_type ADD VALUE IF NOT EXISTS 'set_due_date';
ALTER TYPE automation_action_type ADD VALUE IF NOT EXISTS 'set_custom_field';
ALTER TYPE automation_action_type ADD VALUE IF NOT EXISTS 'send_webhook';

-- ============================================
-- Phase 4C: Automation Conditions
-- ============================================

ALTER TABLE automation_rules
    ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS execution_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

-- ============================================
-- Phase 5: Enhanced Board Templates
-- ============================================

CREATE TABLE IF NOT EXISTS project_template_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6366f1'
);
CREATE INDEX IF NOT EXISTS idx_project_template_labels_template ON project_template_labels(template_id);

CREATE TABLE IF NOT EXISTS project_template_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(20) NOT NULL DEFAULT 'text',
    options JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_project_template_custom_fields_template ON project_template_custom_fields(template_id);

CREATE TABLE IF NOT EXISTS project_template_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(7)
);
CREATE INDEX IF NOT EXISTS idx_project_template_groups_template ON project_template_groups(template_id);
