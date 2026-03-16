-- Report Hub: performance indexes and export jobs table

-- Performance index for activity_log queries by entity_type and created_at
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type_created_at
ON activity_log(entity_type, created_at);

-- Performance index for tasks by project_id and created_at (non-deleted only)
CREATE INDEX IF NOT EXISTS idx_tasks_project_id_created_at
ON tasks(project_id, created_at) WHERE deleted_at IS NULL;

-- Report export jobs table for async PDF generation
CREATE TABLE IF NOT EXISTS report_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    report_type TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'pdf',
    status TEXT NOT NULL DEFAULT 'pending',
    download_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for looking up jobs by user and status
CREATE INDEX IF NOT EXISTS idx_report_jobs_user_status ON report_jobs(user_id, status);
