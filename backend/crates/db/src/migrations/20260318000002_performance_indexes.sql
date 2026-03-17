-- Performance indexes and FTS infrastructure
-- Pre-deploy requirement: CREATE EXTENSION IF NOT EXISTS pg_trgm as superuser

-- pg_trgm (requires superuser pre-install — safety net)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Composite index for automation trigger evaluation (partial)
CREATE INDEX IF NOT EXISTS idx_automation_rules_board_trigger_active
    ON automation_rules(project_id, trigger) WHERE is_active = true;

-- Trigram indexes for ILIKE search on users and labels
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_labels_name_trgm ON labels USING GIN (name gin_trgm_ops);

-- FTS on projects (name + description) — batched backfill
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector;

DO $$
DECLARE batch_size INT := 1000; affected INT;
BEGIN
    LOOP
        UPDATE projects SET search_vector = to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
        WHERE id IN (SELECT id FROM projects WHERE search_vector IS NULL LIMIT batch_size);
        GET DIAGNOSTICS affected = ROW_COUNT;
        EXIT WHEN affected = 0;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_search ON projects USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_project_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_search_vector ON projects;
CREATE TRIGGER trg_project_search_vector
BEFORE INSERT OR UPDATE OF name, description ON projects
FOR EACH ROW EXECUTE FUNCTION update_project_search_vector();

-- FTS on comments (content) — batched backfill
ALTER TABLE comments ADD COLUMN IF NOT EXISTS search_vector tsvector;

DO $$
DECLARE batch_size INT := 1000; affected INT;
BEGIN
    LOOP
        UPDATE comments SET search_vector = to_tsvector('english', coalesce(content, ''))
        WHERE id IN (SELECT id FROM comments WHERE search_vector IS NULL LIMIT batch_size);
        GET DIAGNOSTICS affected = ROW_COUNT;
        EXIT WHEN affected = 0;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_comments_search ON comments USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_comment_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comment_search_vector ON comments;
CREATE TRIGGER trg_comment_search_vector
BEFORE INSERT OR UPDATE OF content ON comments
FOR EACH ROW EXECUTE FUNCTION update_comment_search_vector();

-- Partial index for active projects scoped by workspace
CREATE INDEX IF NOT EXISTS idx_projects_workspace_active
    ON projects(workspace_id) WHERE deleted_at IS NULL;

-- Composite index for activity_log completion queries
CREATE INDEX IF NOT EXISTS idx_activity_log_moved_task
    ON activity_log(action, entity_type, created_at DESC)
    WHERE action = 'moved' AND entity_type = 'task';
