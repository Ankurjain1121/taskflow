-- Task <-> Issue linking (Phase 2.2)
-- Bidirectional link between a task and a related issue, both within the
-- same project. Composite PK prevents duplicate links. CASCADE on either side
-- so when a task or issue is hard-deleted the link disappears.

CREATE TABLE task_issues (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (task_id, issue_id)
);

-- Index the reverse direction so "what tasks link this issue" is fast.
CREATE INDEX idx_task_issues_issue ON task_issues(issue_id);
CREATE INDEX idx_task_issues_creator ON task_issues(created_by_id);
