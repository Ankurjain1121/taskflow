-- Settings & Teams Overhaul: user preferences, session metadata, workspace enhancements, API keys

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    date_format VARCHAR(20) NOT NULL DEFAULT 'MMM dd, yyyy',
    default_board_view VARCHAR(20) NOT NULL DEFAULT 'kanban',
    sidebar_density VARCHAR(20) NOT NULL DEFAULT 'comfortable',
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    digest_frequency VARCHAR(20) NOT NULL DEFAULT 'realtime',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend refresh_tokens with session metadata (no separate user_sessions table)
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Workspace enhancements
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- User enhancements (phone_number already exists, do NOT re-add)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- API keys for workspace integrations
CREATE TABLE IF NOT EXISTS workspace_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,
    created_by_id UUID NOT NULL REFERENCES users(id),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON workspace_api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON workspace_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
