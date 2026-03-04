-- ============================================
-- Phase J1: Automation Templates Infrastructure
-- ============================================

-- Reusable automation templates (system-provided and user-created)
CREATE TABLE IF NOT EXISTS automation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    trigger_type VARCHAR(100) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR(100) NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_templates_workspace_enabled
    ON automation_templates(workspace_id, enabled);

CREATE TRIGGER update_automation_templates_updated_at
    BEFORE UPDATE ON automation_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rate limiting counters per workspace per day
CREATE TABLE IF NOT EXISTS automation_rate_counters (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    date_bucket DATE NOT NULL DEFAULT CURRENT_DATE,
    execution_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (workspace_id, date_bucket)
);

-- Extend automation_logs with execution timing
ALTER TABLE automation_logs
    ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
    ADD COLUMN IF NOT EXISTS timed_out BOOLEAN NOT NULL DEFAULT false;
