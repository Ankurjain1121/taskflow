-- Phase 1: Auth Extensions + Core Features
-- Adds: password reset tokens, subtasks, task extensions, invitation extensions

-- ============================================
-- Password Reset Tokens
-- ============================================

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- ============================================
-- Subtasks / Checklists
-- ============================================

CREATE TABLE subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    position TEXT NOT NULL,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_by_id UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON subtasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Task Extensions
-- ============================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DOUBLE PRECISION;

-- ============================================
-- Invitation Extensions
-- ============================================

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS board_ids JSONB;

-- ============================================
-- Full-text search support
-- ============================================

-- Add tsvector column for task search
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing tasks
UPDATE tasks SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
WHERE search_vector IS NULL;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_tasks_search ON tasks USING GIN(search_vector);

-- Trigger to keep search_vector up to date
CREATE OR REPLACE FUNCTION tasks_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, description ON tasks
    FOR EACH ROW EXECUTE FUNCTION tasks_search_vector_update();
