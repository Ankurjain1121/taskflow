-- Phase 4: Advanced Features
-- Project Templates, Workflow Automation, Board Shares (Client Portal), Webhooks

-- ============================================
-- Project Templates
-- ============================================
CREATE TABLE project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_public BOOLEAN NOT NULL DEFAULT false,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_templates_tenant ON project_templates(tenant_id);
CREATE TRIGGER update_project_templates_updated_at BEFORE UPDATE ON project_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE project_template_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    wip_limit INTEGER,
    status_mapping JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_template_columns_template ON project_template_columns(template_id);

CREATE TABLE project_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    column_index INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority task_priority NOT NULL DEFAULT 'medium',
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_template_tasks_template ON project_template_tasks(template_id);

-- ============================================
-- Workflow Automation
-- ============================================
CREATE TYPE automation_trigger AS ENUM (
    'task_moved', 'task_created', 'task_assigned',
    'task_priority_changed', 'task_due_date_passed', 'task_completed'
);
CREATE TYPE automation_action_type AS ENUM (
    'move_task', 'assign_task', 'set_priority',
    'send_notification', 'add_label', 'set_milestone'
);

CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    trigger automation_trigger NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_automation_rules_board ON automation_rules(board_id);
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    action_type automation_action_type NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_automation_actions_rule ON automation_actions(rule_id);

CREATE TABLE automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    details JSONB
);
CREATE INDEX idx_automation_logs_rule ON automation_logs(rule_id);

-- ============================================
-- Board Shares (Client Portal)
-- ============================================
CREATE TABLE board_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    share_token VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    permissions JSONB NOT NULL DEFAULT '{"view_tasks": true, "view_comments": false}',
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_shares_token ON board_shares(share_token);
CREATE INDEX idx_board_shares_board ON board_shares(board_id);

-- ============================================
-- Webhooks
-- ============================================
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_board ON webhooks(board_id);
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
