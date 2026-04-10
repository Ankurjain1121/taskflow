-- Add 'private' variant to workspace_visibility enum.
-- Private workspaces are only accessible to explicit members,
-- even org admins cannot see them unless explicitly added.
ALTER TYPE workspace_visibility ADD VALUE IF NOT EXISTS 'private';
