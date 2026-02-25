-- Add WIP (Work In Progress) limit to board_columns
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS wip_limit INTEGER;
