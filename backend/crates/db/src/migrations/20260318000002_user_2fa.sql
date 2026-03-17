-- Two-Factor Authentication table
-- Stores TOTP secrets, enabled state, and hashed recovery codes per user.

CREATE TABLE IF NOT EXISTS user_2fa (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    totp_secret   TEXT NOT NULL,
    totp_enabled  BOOLEAN NOT NULL DEFAULT false,
    recovery_codes JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup during login
CREATE INDEX IF NOT EXISTS idx_user_2fa_enabled ON user_2fa(user_id) WHERE totp_enabled = true;
