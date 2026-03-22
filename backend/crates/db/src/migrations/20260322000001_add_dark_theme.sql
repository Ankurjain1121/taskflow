-- Re-adding dark theme support (previously dark_theme_slug in 20260221000003, dropped in 20260315000001)
-- Step 1: Migrate legacy accent_color values FIRST (before adding constraint)
UPDATE user_preferences
  SET accent_color = 'warm-earth'
  WHERE accent_color NOT IN (
    'white-heaven', 'sea-foam', 'warm-earth', 'storm-cloud',
    'morning-sky', 'misty-forest', 'modern-dental'
  );

-- Step 2: Add dark_theme column (VARCHAR(30) for future-proofing)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS dark_theme VARCHAR(30) DEFAULT 'warm-earth-dark';
