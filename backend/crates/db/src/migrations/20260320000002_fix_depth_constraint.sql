-- Fix depth constraint to match application code (depth >= 0 AND depth <= 5)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_task_depth;
ALTER TABLE tasks ADD CONSTRAINT chk_task_depth CHECK (depth >= 0 AND depth <= 5);
