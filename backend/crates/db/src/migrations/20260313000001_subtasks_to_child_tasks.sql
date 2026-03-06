-- Migration: Upgrade subtasks to first-class child tasks
-- Adds parent_task_id and depth to tasks table, migrates existing subtask data

-- Step 1: Add parent_task_id column
ALTER TABLE tasks ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Step 2: Add depth column (0=root, 1=subtask, 2=sub-subtask)
ALTER TABLE tasks ADD COLUMN depth SMALLINT NOT NULL DEFAULT 0;

-- Step 3: Create partial index for child task lookups
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Step 4: Enforce max depth of 2
ALTER TABLE tasks ADD CONSTRAINT chk_task_depth CHECK (depth >= 0 AND depth <= 2);

-- Step 5: Migrate existing subtasks into tasks table
-- Preserve UUIDs so any external references still work
-- Child tasks inherit board_id, column_id, tenant_id from parent
-- Use first column of parent's board if we want them in the same column
INSERT INTO tasks (
    id, title, description, priority, due_date, board_id, column_id,
    position, tenant_id, created_by_id, parent_task_id, depth,
    created_at, updated_at
)
SELECT
    s.id,
    s.title,
    NULL,                        -- subtasks had no description
    'medium',                    -- default priority
    s.due_date::timestamptz,     -- cast NaiveDate to timestamptz
    t.board_id,
    t.column_id,                 -- inherit parent's column
    s.position,
    t.tenant_id,
    s.created_by_id,
    s.task_id,                   -- parent_task_id = subtask's task_id
    1,                           -- depth = 1 (direct child)
    s.created_at,
    s.updated_at
FROM subtasks s
INNER JOIN tasks t ON t.id = s.task_id
WHERE t.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 6: Migrate subtask assignees into task_assignees
INSERT INTO task_assignees (id, task_id, user_id)
SELECT gen_random_uuid(), s.id, s.assigned_to_id
FROM subtasks s
WHERE s.assigned_to_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Step 7: For completed subtasks, mark them by moving to the parent's board's done column (if one exists)
-- This preserves the is_completed state by placing them in a done column
UPDATE tasks child
SET column_id = done_col.id
FROM subtasks s
INNER JOIN tasks parent ON parent.id = s.task_id
INNER JOIN board_columns done_col ON done_col.board_id = parent.board_id
    AND done_col.status_mapping->>'done' = 'true'
WHERE child.id = s.id
    AND s.is_completed = true
    AND child.parent_task_id IS NOT NULL;

-- Note: subtasks table is kept for 30-day rollback period (DEPRECATED)
-- DROP TABLE subtasks; -- uncomment after 30 days
