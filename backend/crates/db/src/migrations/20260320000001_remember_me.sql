-- Add persistent flag to refresh_tokens for "Remember Me" feature.
-- true  = cookies get Max-Age (persistent, 7-day default)
-- false = cookies omit Max-Age (session cookies, deleted on browser close)
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS persistent BOOLEAN NOT NULL DEFAULT true;
