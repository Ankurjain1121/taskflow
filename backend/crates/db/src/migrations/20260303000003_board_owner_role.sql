-- Add 'owner' value to board_member_role enum
-- ALTER TYPE ... ADD VALUE must be run outside a transaction in PostgreSQL
ALTER TYPE board_member_role ADD VALUE IF NOT EXISTS 'owner';
