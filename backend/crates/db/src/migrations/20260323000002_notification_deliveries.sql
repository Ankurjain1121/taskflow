CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,  -- 'whatsapp', 'email', 'slack'
    status TEXT NOT NULL DEFAULT 'sent',  -- 'sent', 'failed', 'pending'
    external_id TEXT,  -- WAHA message ID or provider ID
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_deliveries_recipient ON notification_deliveries(recipient_id, created_at DESC);
CREATE INDEX idx_notification_deliveries_channel ON notification_deliveries(channel, created_at DESC);
