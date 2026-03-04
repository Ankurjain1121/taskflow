-- Mark boards as sample/demo boards for easy identification and deletion
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT false;

-- Index for quick lookup of sample boards
CREATE INDEX IF NOT EXISTS idx_boards_is_sample ON boards(is_sample) WHERE is_sample = true;
