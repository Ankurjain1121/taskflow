-- Cascade soft-deletes from projects to tasks (and task_assignees, task_watchers).
-- When a project's deleted_at is set, all its tasks get soft-deleted too.
-- This prevents orphaned tasks from appearing in reports and queries.

CREATE OR REPLACE FUNCTION cascade_project_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Only fire when deleted_at changes from NULL to non-NULL
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE tasks
        SET deleted_at = NEW.deleted_at
        WHERE project_id = NEW.id
          AND deleted_at IS NULL;
    END IF;

    -- If project is restored (deleted_at set back to NULL), restore tasks too
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        UPDATE tasks
        SET deleted_at = NULL
        WHERE project_id = NEW.id
          AND deleted_at = OLD.deleted_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_project_soft_delete ON projects;

CREATE TRIGGER trg_cascade_project_soft_delete
    AFTER UPDATE OF deleted_at ON projects
    FOR EACH ROW
    EXECUTE FUNCTION cascade_project_soft_delete();

-- Also add a similar trigger for tasks → subtasks
-- When a parent task is soft-deleted, cascade to child tasks
CREATE OR REPLACE FUNCTION cascade_task_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE tasks
        SET deleted_at = NEW.deleted_at
        WHERE parent_task_id = NEW.id
          AND deleted_at IS NULL;
    END IF;

    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        UPDATE tasks
        SET deleted_at = NULL
        WHERE parent_task_id = NEW.id
          AND deleted_at = OLD.deleted_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_task_soft_delete ON tasks;

CREATE TRIGGER trg_cascade_task_soft_delete
    AFTER UPDATE OF deleted_at ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION cascade_task_soft_delete();
