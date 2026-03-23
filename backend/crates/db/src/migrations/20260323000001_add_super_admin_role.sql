-- Add super_admin to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';

-- Ensure only one super_admin per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_one_super_admin_per_tenant
ON users (tenant_id) WHERE role = 'super_admin' AND deleted_at IS NULL;
