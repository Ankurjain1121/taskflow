-- Add workspace visibility setting
-- Enables open workspaces that any tenant member can discover and join

DO $$ BEGIN
    CREATE TYPE workspace_visibility AS ENUM ('open', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS visibility workspace_visibility NOT NULL DEFAULT 'closed';
