-- Add composite indexes for performance
-- Using IF NOT EXISTS to be idempotent

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_user
ON task_assignees(task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user_task
ON task_assignees(user_id, task_id);

CREATE INDEX IF NOT EXISTS idx_automations_project_trigger
ON automations(project_id, trigger_type);
