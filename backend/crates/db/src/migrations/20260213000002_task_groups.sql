-- Task Groups/Sections Feature
-- Adds the missing hierarchy level between boards and tasks

-- Create task_groups table
CREATE TABLE task_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    position TEXT NOT NULL,  -- Fractional indexing for ordering
    collapsed BOOLEAN DEFAULT false,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_task_groups_board ON task_groups(board_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_task_groups_tenant ON task_groups(tenant_id);
CREATE INDEX idx_task_groups_position ON task_groups(board_id, position) WHERE deleted_at IS NULL;

-- Add group_id column to tasks table
ALTER TABLE tasks ADD COLUMN group_id UUID REFERENCES task_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_group ON tasks(group_id) WHERE group_id IS NOT NULL;

-- Create default "Ungrouped" group for each existing board
INSERT INTO task_groups (board_id, name, color, position, tenant_id, created_by_id)
SELECT
    b.id,
    'Ungrouped',
    '#94a3b8',
    'a0',  -- First position in fractional indexing
    b.tenant_id,
    b.created_by_id
FROM boards b
WHERE b.deleted_at IS NULL;

-- Assign all existing tasks to their board's "Ungrouped" group
UPDATE tasks t
SET group_id = tg.id
FROM task_groups tg
WHERE t.board_id = tg.board_id
  AND tg.name = 'Ungrouped'
  AND t.group_id IS NULL
  AND t.deleted_at IS NULL;

-- Add trigger to auto-create "Ungrouped" group for new boards
CREATE OR REPLACE FUNCTION create_default_task_group()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_groups (board_id, name, color, position, tenant_id, created_by_id)
    VALUES (NEW.id, 'Ungrouped', '#94a3b8', 'a0', NEW.tenant_id, NEW.created_by_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_task_group
AFTER INSERT ON boards
FOR EACH ROW
EXECUTE FUNCTION create_default_task_group();
