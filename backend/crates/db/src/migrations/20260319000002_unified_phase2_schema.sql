-- Migration: Unified Phase 2 - All additive schema changes
-- Safe, atomic, zero-downtime (all IF NOT EXISTS / IF EXISTS guards)

-- 1. Project lifecycle columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'archived'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_date DATE;

-- 2. Task hierarchy enhancement
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS child_count INT NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_child_count INT NOT NULL DEFAULT 0;

-- 3. Create trigger for child_count maintenance
CREATE OR REPLACE FUNCTION update_child_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_task_id IS NOT NULL THEN
    UPDATE tasks SET child_count = child_count + 1 WHERE id = NEW.parent_task_id;
    IF NEW.status_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_statuses WHERE id = NEW.status_id AND type = 'done'
    ) THEN
      UPDATE tasks SET completed_child_count = completed_child_count + 1 WHERE id = NEW.parent_task_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_task_id IS NOT NULL THEN
    UPDATE tasks SET child_count = child_count - 1 WHERE id = OLD.parent_task_id;
    IF OLD.status_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_statuses WHERE id = OLD.status_id AND type = 'done'
    ) THEN
      UPDATE tasks SET completed_child_count = completed_child_count - 1 WHERE id = OLD.parent_task_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Parent changed
    IF OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id THEN
      IF OLD.parent_task_id IS NOT NULL THEN
        UPDATE tasks SET child_count = child_count - 1 WHERE id = OLD.parent_task_id;
        IF OLD.status_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM project_statuses WHERE id = OLD.status_id AND type = 'done'
        ) THEN
          UPDATE tasks SET completed_child_count = completed_child_count - 1 WHERE id = OLD.parent_task_id;
        END IF;
      END IF;
      IF NEW.parent_task_id IS NOT NULL THEN
        UPDATE tasks SET child_count = child_count + 1 WHERE id = NEW.parent_task_id;
        IF NEW.status_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM project_statuses WHERE id = NEW.status_id AND type = 'done'
        ) THEN
          UPDATE tasks SET completed_child_count = completed_child_count + 1 WHERE id = NEW.parent_task_id;
        END IF;
      END IF;
    -- Status changed (same parent)
    ELSIF NEW.parent_task_id IS NOT NULL AND OLD.status_id IS DISTINCT FROM NEW.status_id THEN
      -- Check if old status was done
      IF OLD.status_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM project_statuses WHERE id = OLD.status_id AND type = 'done'
      ) THEN
        -- Was done, check if new is not done
        IF NEW.status_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM project_statuses WHERE id = NEW.status_id AND type = 'done'
        ) THEN
          UPDATE tasks SET completed_child_count = completed_child_count - 1 WHERE id = NEW.parent_task_id;
        END IF;
      ELSE
        -- Was not done, check if new is done
        IF NEW.status_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM project_statuses WHERE id = NEW.status_id AND type = 'done'
        ) THEN
          UPDATE tasks SET completed_child_count = completed_child_count + 1 WHERE id = NEW.parent_task_id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_child_counts ON tasks;
CREATE TRIGGER trg_update_child_counts
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_child_counts();

-- 4. Backfill child_count from existing data
WITH counts AS (
  SELECT
    c.parent_task_id,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE ps.type = 'done') AS done
  FROM tasks c
  LEFT JOIN project_statuses ps ON ps.id = c.status_id
  WHERE c.parent_task_id IS NOT NULL
    AND c.deleted_at IS NULL
  GROUP BY c.parent_task_id
)
UPDATE tasks t SET
  child_count = counts.total,
  completed_child_count = counts.done
FROM counts
WHERE t.id = counts.parent_task_id;

-- 5. Saved views
CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  view_type VARCHAR(20) NOT NULL CHECK (view_type IN ('kanban', 'list', 'table', 'calendar', 'gantt', 'reports', 'time-report', 'activity')),
  config JSONB NOT NULL DEFAULT '{}',
  pinned BOOLEAN NOT NULL DEFAULT false,
  shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_saved_view_name UNIQUE(user_id, project_id, name),
  CONSTRAINT chk_config_size CHECK (length(config::text) < 10240)
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user_ws ON saved_views(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_project ON saved_views(project_id) WHERE project_id IS NOT NULL;

-- 6. Personal work board
CREATE TABLE IF NOT EXISTS personal_task_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL DEFAULT 'backlog' CHECK (column_name IN ('backlog', 'today', 'in_progress', 'done')),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- 7. Task snoozes
CREATE TABLE IF NOT EXISTS task_snoozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  snoozed_until DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- 8. Cross-project indexes
CREATE INDEX IF NOT EXISTS idx_project_members_lookup ON project_members(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_due ON tasks(project_id, due_date);
