ALTER TABLE user_preferences DROP COLUMN IF EXISTS light_theme_slug;
ALTER TABLE user_preferences DROP COLUMN IF EXISTS dark_theme_slug;
DROP TABLE IF EXISTS themes CASCADE;
