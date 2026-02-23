-- Positions: board-scoped organizational roles for recurring task assignment with fallback chain

-- Board-level organizational positions
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    fallback_position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(board_id, name)
);

-- Who currently holds a position (M:M)
CREATE TABLE IF NOT EXISTS position_holders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(position_id, user_id)
);

-- Link recurring task configs to positions
ALTER TABLE recurring_task_configs
    ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_positions_board ON positions(board_id);
CREATE INDEX IF NOT EXISTS idx_positions_tenant ON positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_position_holders_position ON position_holders(position_id);
CREATE INDEX IF NOT EXISTS idx_position_holders_user ON position_holders(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_configs_position ON recurring_task_configs(position_id) WHERE position_id IS NOT NULL;
