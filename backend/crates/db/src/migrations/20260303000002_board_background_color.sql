-- Add background_color to boards table
ALTER TABLE boards ADD COLUMN IF NOT EXISTS background_color VARCHAR(7) DEFAULT NULL;
