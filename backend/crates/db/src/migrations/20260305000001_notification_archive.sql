-- Add archived_at column for soft-delete support
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(recipient_id, archived_at) WHERE archived_at IS NULL;
