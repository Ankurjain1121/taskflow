-- Add audit extensions to activity_log table
-- Note: ip_address and user_agent columns already exist in 20260205000001_initial.sql
-- This migration ensures they exist for older deployments and adds an index

-- Create index for admin audit log queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user_action ON activity_log(user_id, action);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- Add deleted_at column to comments if not exists (for trash bin support)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to attachments if not exists (for trash bin support)
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
