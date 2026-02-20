-- Migration 1: Create themes table
-- This table stores all theme configurations including colors, personality settings, and PrimeNG ramps

CREATE TABLE IF NOT EXISTS themes (
    slug         VARCHAR(60) PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    category     VARCHAR(40) NOT NULL
        CHECK (category IN ('clean','dark-sidebar','tinted','famous','bold','specialty')),
    description  TEXT NOT NULL DEFAULT '',
    is_dark      BOOLEAN NOT NULL DEFAULT false,
    sort_order   SMALLINT NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    colors       JSONB NOT NULL,
    personality  JSONB NOT NULL DEFAULT '{"sidebar_style":"light","card_style":"raised","border_radius":"medium","background_pattern":"none"}'::jsonb,
    preview      JSONB NOT NULL DEFAULT '{}'::jsonb,
    primeng_ramp JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_sidebar CHECK (personality->>'sidebar_style' IN ('light','dark','tinted')),
    CONSTRAINT valid_card CHECK (personality->>'card_style' IN ('flat','raised','bordered')),
    CONSTRAINT valid_radius CHECK (personality->>'border_radius' IN ('small','medium','large')),
    CONSTRAINT valid_pattern CHECK (personality->>'background_pattern' IN ('none','dots','grid','waves'))
);

CREATE INDEX IF NOT EXISTS idx_themes_active ON themes(is_active, category, sort_order);
