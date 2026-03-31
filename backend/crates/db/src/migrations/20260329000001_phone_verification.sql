-- Phone verification support
-- Adds phone_verified column and indexes for phone login + verified uniqueness

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- Unique verified phone prevents duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_verified_unique
  ON users(phone_number) WHERE phone_number IS NOT NULL AND phone_verified = true;

-- Fast lookup for phone login
CREATE INDEX IF NOT EXISTS idx_users_phone_login
  ON users(phone_number) WHERE phone_number IS NOT NULL AND deleted_at IS NULL;
