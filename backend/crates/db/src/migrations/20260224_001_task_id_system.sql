-- Task ID numbering system: BOARD-123 style short IDs
-- Adds prefix to boards and task_number to tasks

-- Board prefix (e.g., "DEV", "MARKETING")
ALTER TABLE boards ADD COLUMN IF NOT EXISTS prefix VARCHAR(10);

-- Auto-incrementing task number per board
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_number INTEGER;

-- Index for fast lookup by board + task_number
CREATE INDEX IF NOT EXISTS idx_tasks_board_task_number ON tasks (board_id, task_number);

-- Backfill: Generate prefixes from first 3 chars of board name (uppercase)
UPDATE boards
SET prefix = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'), 4))
WHERE prefix IS NULL;

-- Backfill: Assign task numbers to existing tasks ordered by creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY board_id ORDER BY created_at ASC) AS rn
  FROM tasks
  WHERE task_number IS NULL
)
UPDATE tasks
SET task_number = numbered.rn
FROM numbered
WHERE tasks.id = numbered.id;
