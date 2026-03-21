-- Migrate legacy subtasks to child tasks (real tasks with parent_task_id)
-- This preserves all subtask data as first-class child tasks

-- Step 1: Insert legacy subtasks as child tasks
INSERT INTO tasks (
    id, title, priority, project_id, status_id, task_list_id, position,
    tenant_id, created_by_id, parent_task_id, depth, due_date,
    created_at, updated_at
)
SELECT
    s.id,
    s.title,
    'medium'::task_priority,
    t.project_id,
    CASE WHEN s.is_completed THEN (
        SELECT ps.id FROM project_statuses ps
        WHERE ps.project_id = t.project_id AND ps.type = 'done'
        ORDER BY ps.position ASC LIMIT 1
    ) ELSE t.status_id END,
    t.task_list_id,
    s.position,
    t.tenant_id,
    s.created_by_id,
    s.task_id,
    t.depth + 1,
    s.due_date::timestamptz,
    s.created_at,
    s.updated_at
FROM subtasks s
JOIN tasks t ON t.id = s.task_id
WHERE t.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 2: Migrate assignees from subtasks to task_assignees
INSERT INTO task_assignees (task_id, user_id)
SELECT s.id, s.assigned_to_id
FROM subtasks s
WHERE s.assigned_to_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Step 3: Drop the legacy subtasks table
DROP TABLE IF EXISTS subtasks;
