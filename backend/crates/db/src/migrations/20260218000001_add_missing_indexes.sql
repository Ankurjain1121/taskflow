-- Add missing indexes for frequently queried user_id columns
-- These tables have UNIQUE(x_id, user_id) but queries often filter by user_id alone.

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);

-- Partial index for active (non-deleted) tasks with due dates — used by dashboard overdue/deadline queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_active ON tasks(due_date)
    WHERE deleted_at IS NULL AND due_date IS NOT NULL;
