-- Eisenhower Matrix Feature
-- Adds urgency and importance fields for 2×2 prioritization grid

-- ============================================
-- Eisenhower Matrix Fields
-- ============================================
-- NULL = auto-compute based on due_date and priority
-- true/false = manual user override via drag-and-drop

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS eisenhower_urgency BOOLEAN DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS eisenhower_importance BOOLEAN DEFAULT NULL;

-- Add indexes for efficient querying by quadrant
CREATE INDEX IF NOT EXISTS idx_tasks_eisenhower ON tasks(eisenhower_urgency, eisenhower_importance) WHERE deleted_at IS NULL;

COMMENT ON COLUMN tasks.eisenhower_urgency IS 'NULL=auto (due_date<=today+2days), true/false=manual override';
COMMENT ON COLUMN tasks.eisenhower_importance IS 'NULL=auto (priority=urgent|high), true/false=manual override';
