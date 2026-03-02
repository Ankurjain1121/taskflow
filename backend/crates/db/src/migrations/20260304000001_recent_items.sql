CREATE TABLE IF NOT EXISTS recent_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'board')),
    entity_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_recent_items_user ON recent_items(user_id, viewed_at DESC);
CREATE INDEX idx_recent_items_tenant ON recent_items(tenant_id);
