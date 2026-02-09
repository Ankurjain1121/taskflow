-- Phase 2: Project Planning Features
-- Adds: task dependencies, milestones, tasks.milestone_id

-- ============================================
-- Task Dependencies
-- ============================================

CREATE TYPE dependency_type AS ENUM ('blocks', 'blocked_by', 'related');

CREATE TABLE task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type dependency_type NOT NULL DEFAULT 'blocks',
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_task_id, target_task_id),
    CHECK (source_task_id != target_task_id)
);

CREATE INDEX idx_task_deps_source ON task_dependencies(source_task_id);
CREATE INDEX idx_task_deps_target ON task_dependencies(target_task_id);

-- ============================================
-- Milestones
-- ============================================

CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_board ON milestones(board_id);
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add milestone_id to tasks
ALTER TABLE tasks ADD COLUMN milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);
