-- ============================================
-- Phase J3: Bulk Operations Audit Log
-- ============================================

-- Track bulk operations for undo support (1-hour TTL)
CREATE TABLE IF NOT EXISTS bulk_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    affected_task_ids UUID[] NOT NULL DEFAULT '{}',
    changes_summary JSONB NOT NULL DEFAULT '{}',
    task_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_user_created
    ON bulk_operations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_expires
    ON bulk_operations(expires_at);
