-- Workspace-level labels migration
-- Adds workspace_id to labels table so labels can be workspace-scoped

-- Add workspace_id column (nullable initially for migration)
ALTER TABLE labels ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add tenant_id for RLS
ALTER TABLE labels ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Add created_by for audit
ALTER TABLE labels ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);

-- Add timestamps
ALTER TABLE labels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Populate workspace_id from board's workspace for existing labels
UPDATE labels l
SET workspace_id = b.workspace_id,
    tenant_id = b.tenant_id
FROM boards b
WHERE l.board_id = b.id
  AND l.workspace_id IS NULL;

-- Make board_id nullable (labels can be workspace-scoped without a specific board)
ALTER TABLE labels ALTER COLUMN board_id DROP NOT NULL;

-- Make workspace_id NOT NULL after backfill
ALTER TABLE labels ALTER COLUMN workspace_id SET NOT NULL;

-- Add index for workspace-level label queries
CREATE INDEX IF NOT EXISTS idx_labels_workspace ON labels(workspace_id);

-- Add unique constraint for workspace-level label names
CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_workspace_name ON labels(workspace_id, name) WHERE board_id IS NULL;
