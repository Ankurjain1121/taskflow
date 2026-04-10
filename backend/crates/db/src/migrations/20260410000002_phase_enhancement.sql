-- Phases enhancement: upgrade "milestones" into "phases"-style entities
-- Adds owner, status, start_date, flag to milestones table.
-- Keeps existing "milestones" table name for backward compat — the frontend
-- presents them as "Phases" in the Zoho-inspired UX.

-- 1. Add new columns
ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed'));

ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;

ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS flag VARCHAR(32) NOT NULL DEFAULT 'internal'
    CHECK (flag IN ('internal', 'external', 'critical'));

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_milestones_owner ON milestones(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
