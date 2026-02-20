-- Migration 3: Add theme-related columns to user_preferences
-- This must run AFTER themes_seed.sql to ensure FK references work

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS light_theme_slug VARCHAR(60) DEFAULT 'default'
        REFERENCES themes(slug) ON UPDATE CASCADE ON DELETE SET DEFAULT,
    ADD COLUMN IF NOT EXISTS dark_theme_slug VARCHAR(60) DEFAULT 'default'
        REFERENCES themes(slug) ON UPDATE CASCADE ON DELETE SET DEFAULT,
    ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT 'indigo',
    ADD COLUMN IF NOT EXISTS color_mode VARCHAR(10) DEFAULT 'system'
        CHECK (color_mode IN ('light', 'dark', 'system'));
