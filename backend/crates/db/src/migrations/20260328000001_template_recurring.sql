-- Template-based recurring task configs
-- Allows recurring configs to store a task_template JSONB instead of referencing an existing task.
-- The cron job creates fresh tasks from the template on schedule.

-- Add task_template JSONB column for template-based recurring configs
ALTER TABLE recurring_task_configs ADD COLUMN IF NOT EXISTS task_template JSONB DEFAULT NULL;

-- Make task_id nullable (template configs have no initial task)
ALTER TABLE recurring_task_configs ALTER COLUMN task_id DROP NOT NULL;

-- Every config must have either task_id or task_template (or both)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_task_or_template'
    ) THEN
        ALTER TABLE recurring_task_configs
            ADD CONSTRAINT chk_task_or_template
            CHECK (task_id IS NOT NULL OR task_template IS NOT NULL);
    END IF;
END$$;
