-- QA Hardening: critical and high-priority fixes from TaskBolt QA audit
-- 1. Unique constraint on task_number per project (prevents duplicates)
-- 2. Composite partial index for common task query pattern
-- 3. Add updated_at column + trigger to workspace_members

-- 1. Prevent duplicate task_number within a project.
-- The advisory lock in application code is the primary guard, but this
-- constraint provides a database-level safety net.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_tasks_project_task_number'
    ) THEN
        ALTER TABLE tasks
            ADD CONSTRAINT uq_tasks_project_task_number
            UNIQUE (project_id, task_number);
    END IF;
END
$$;

-- 2. Partial composite index for the most common task list query:
--    "all root-level, non-deleted tasks in a project"
CREATE INDEX IF NOT EXISTS idx_tasks_project_active_root
    ON tasks (project_id)
    WHERE deleted_at IS NULL AND parent_task_id IS NULL;

-- 3. Add updated_at to workspace_members so we can track membership changes.
ALTER TABLE workspace_members
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create the trigger only if it does not already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_workspace_members_updated_at'
    ) THEN
        CREATE TRIGGER set_workspace_members_updated_at
            BEFORE UPDATE ON workspace_members
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;
