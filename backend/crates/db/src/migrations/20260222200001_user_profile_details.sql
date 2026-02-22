-- Add profile detail columns to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS job_title TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add job_title column to invitations (set by inviter, applied on accept)
ALTER TABLE invitations
    ADD COLUMN IF NOT EXISTS job_title TEXT;
