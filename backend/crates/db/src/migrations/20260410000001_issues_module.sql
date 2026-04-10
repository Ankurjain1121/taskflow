-- Issues Module (Zoho Phase 1)
-- Separate bug/issue tracker parallel to tasks.
-- Issues have severity (not priority), reporter, classification, resolution workflow.

-- ============================================
-- Enums
-- ============================================

CREATE TYPE issue_status AS ENUM (
    'open',
    'in_progress',
    'on_hold',
    'closed',
    'reopened'
);

CREATE TYPE issue_severity AS ENUM (
    'none',
    'minor',
    'major',
    'critical',
    'show_stopper'
);

CREATE TYPE issue_classification AS ENUM (
    'bug',
    'feature_request',
    'improvement',
    'task',
    'other'
);

CREATE TYPE issue_reproducibility AS ENUM (
    'always',
    'sometimes',
    'rarely',
    'unable',
    'not_applicable'
);

CREATE TYPE issue_resolution_type AS ENUM (
    'fixed',
    'wont_fix',
    'duplicate',
    'deferred',
    'not_a_bug',
    'cannot_reproduce'
);

-- ============================================
-- Issues table
-- ============================================

CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    issue_number INTEGER NOT NULL,

    title VARCHAR(500) NOT NULL,
    description TEXT,

    reporter_id UUID NOT NULL REFERENCES users(id),
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,

    status issue_status NOT NULL DEFAULT 'open',
    severity issue_severity NOT NULL DEFAULT 'none',
    classification issue_classification NOT NULL DEFAULT 'bug',
    reproducibility issue_reproducibility,

    module VARCHAR(255),
    affected_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    release_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,

    due_date TIMESTAMPTZ,

    -- Resolution tracking
    resolution_type issue_resolution_type,
    resolution_notes TEXT,
    resolved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,

    -- Internal/external flag
    flag VARCHAR(32) NOT NULL DEFAULT 'internal',

    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (project_id, issue_number)
);

CREATE INDEX idx_issues_project ON issues(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_issues_tenant ON issues(tenant_id);
CREATE INDEX idx_issues_assignee ON issues(assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_issues_reporter ON issues(reporter_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_issues_status ON issues(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_issues_severity ON issues(severity) WHERE deleted_at IS NULL;
CREATE INDEX idx_issues_due_date ON issues(due_date) WHERE deleted_at IS NULL AND status != 'closed';

-- ============================================
-- Auto-numbering trigger (per project)
-- ============================================

CREATE OR REPLACE FUNCTION assign_issue_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.issue_number IS NULL OR NEW.issue_number = 0 THEN
        SELECT COALESCE(MAX(issue_number), 0) + 1
        INTO NEW.issue_number
        FROM issues
        WHERE project_id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_issue_number
    BEFORE INSERT ON issues
    FOR EACH ROW
    EXECUTE FUNCTION assign_issue_number();

-- ============================================
-- updated_at trigger
-- ============================================

CREATE TRIGGER update_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Issue tags (polymorphic with tasks not possible; separate join table)
-- ============================================

CREATE TABLE issue_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    UNIQUE (issue_id, label_id)
);

CREATE INDEX idx_issue_labels_issue ON issue_labels(issue_id);
CREATE INDEX idx_issue_labels_label ON issue_labels(label_id);
