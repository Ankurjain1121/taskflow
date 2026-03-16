-- Add optional project_id for per-project notification preferences
-- NULL = global default, non-NULL = project-specific override
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Update unique constraint to include project_id (allows per-project overrides)
-- First drop old constraint if it exists
ALTER TABLE notification_preferences
DROP CONSTRAINT IF EXISTS notification_preferences_user_id_event_type_key;

-- Add new composite unique constraint (uses COALESCE for NULL-safe uniqueness)
-- We use a unique index instead of constraint to handle NULLs properly
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_prefs_user_event_project
ON notification_preferences (user_id, event_type, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'));
