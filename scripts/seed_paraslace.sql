-- =============================================================================
-- TaskFlow Seed: Paraslace tenant (admin1@paraslace.in)
-- 19 new users + 4 projects + 500 tasks for testing
-- =============================================================================
-- Usage: psql -f scripts/seed_paraslace.sql
-- Or:   ./scripts/run_seed.sh --paraslace
-- =============================================================================

\set ON_ERROR_STOP on

CREATE TEMP TABLE IF NOT EXISTS _su (seq INT PRIMARY KEY, uid UUID NOT NULL);
CREATE TEMP TABLE IF NOT EXISTS _sb (seq INT PRIMARY KEY, pid UUID NOT NULL);
CREATE TEMP TABLE IF NOT EXISTS _ss (pid UUID, seq INT, sid UUID, PRIMARY KEY (pid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sg (pid UUID, seq INT, gid UUID, PRIMARY KEY (pid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sm (pid UUID, seq INT, mid UUID, PRIMARY KEY (pid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sl (pid UUID, seq INT, lid UUID, PRIMARY KEY (pid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sf (pid UUID, seq INT, fid UUID, PRIMARY KEY (pid, seq));
CREATE TEMP TABLE IF NOT EXISTS _st (seq INT PRIMARY KEY, tid UUID NOT NULL, pid UUID NOT NULL);

DO $$
DECLARE
    v_tenant_id     UUID;
    v_workspace_id  UUID;
    v_pass_hash     TEXT;

    v_id            UUID;
    v_pid           UUID;
    v_sid           UUID;
    v_gid           UUID;
    v_mid           UUID;
    v_lid           UUID;
    v_tid           UUID;
    v_uid           UUID;
    v_uid2          UUID;
    v_src           UUID;
    v_tgt           UUID;

    i               INTEGER;
    p               INTEGER;

    v_global_seq    INTEGER;
    v_priority      task_priority;
    v_dep_type      dependency_type;
    v_title         TEXT;
    v_due           DATE;
    v_mile_count    INTEGER;
    v_start_user    INTEGER;
    v_team_size     INTEGER;
    v_status_count  INTEGER;

    team_starts     INTEGER[] := ARRAY[1, 6, 10, 14];
    team_sizes      INTEGER[] := ARRAY[5, 4,  4,  4];

    eng_actions     TEXT[] := ARRAY['Implement','Fix','Refactor','Add tests for','Review','Update','Optimize','Debug','Migrate','Remove'];
    eng_subjects    TEXT[] := ARRAY['authentication','API gateway','database queries','WebSocket handler','task service','user model','file upload','notification system','search feature','caching layer','rate limiter','CI pipeline','error handling','logging system','queue worker'];

    des_actions     TEXT[] := ARRAY['Design','Update','Create','Review','Refine','Document','Prototype','Audit','Standardize','Improve'];
    des_subjects    TEXT[] := ARRAY['button component','color tokens','typography system','card layout','modal dialog','navigation bar','form inputs','icon library','spacing system','dark mode','loading states','error states','mobile layout','accessibility','design spec'];

    mkt_actions     TEXT[] := ARRAY['Create','Plan','Write','Publish','Schedule','Analyze','Design','Launch','Track','Review'];
    mkt_subjects    TEXT[] := ARRAY['blog post','email campaign','social media post','landing page','case study','video script','press release','newsletter','ad creative','SEO strategy','webinar','infographic','product update','customer survey','event plan'];

    prd_actions     TEXT[] := ARRAY['Define','Write PRD for','Research','Prioritize','Plan','Validate','Launch','Iterate on','Document','Analyze'];
    prd_subjects    TEXT[] := ARRAY['user authentication','onboarding flow','dashboard redesign','mobile app','API v2','notifications system','team collaboration','billing integration','analytics dashboard','search functionality','file sharing','integrations hub','reporting module','admin panel','public API'];

BEGIN
    -- =========================================================================
    -- LOCATE EXISTING TENANT, WORKSPACE, ADMIN USER
    -- =========================================================================
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'paraslace';
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant "paraslace" not found. Register admin1@paraslace.in first.';
    END IF;

    SELECT id INTO v_workspace_id FROM workspaces WHERE tenant_id = v_tenant_id LIMIT 1;
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'No workspace found for paraslace tenant.';
    END IF;

    -- Reuse admin1 password hash for all new users
    SELECT password_hash INTO v_pass_hash FROM users WHERE email = 'admin1@paraslace.in';

    -- Idempotency: check if seed users already exist
    IF EXISTS (SELECT 1 FROM users WHERE email = 'bob@paraslace.in' AND tenant_id = v_tenant_id) THEN
        RAISE NOTICE 'Paraslace seed data already exists. Run with --force-paraslace to recreate.';
        RETURN;
    END IF;

    RAISE NOTICE 'Seeding paraslace tenant with 19 users + 4 projects + 500 tasks...';

    -- =========================================================================
    -- Register admin1 as user seq 1
    -- =========================================================================
    SELECT id INTO v_uid FROM users WHERE email = 'admin1@paraslace.in';
    INSERT INTO _su VALUES (1, v_uid);

    -- =========================================================================
    -- CREATE 19 NEW USERS (seq 2-20)
    -- =========================================================================
    WITH user_data(seq, email, full_name, job_title, dept) AS (
        VALUES
            (2,  'bob@paraslace.in',    'Bob Smith',         'Senior Engineer',     'Engineering'),
            (3,  'carol@paraslace.in',  'Carol White',       'Backend Engineer',    'Engineering'),
            (4,  'david@paraslace.in',  'David Brown',       'Frontend Engineer',   'Engineering'),
            (5,  'emma@paraslace.in',   'Emma Davis',        'DevOps Engineer',     'Engineering'),
            (6,  'frank@paraslace.in',  'Frank Miller',      'Design Lead',         'Design'),
            (7,  'grace@paraslace.in',  'Grace Wilson',      'UI Designer',         'Design'),
            (8,  'henry@paraslace.in',  'Henry Taylor',      'UX Researcher',       'Design'),
            (9,  'iris@paraslace.in',   'Iris Anderson',     'Visual Designer',     'Design'),
            (10, 'james@paraslace.in',  'James Thomas',      'Marketing Lead',      'Marketing'),
            (11, 'kate@paraslace.in',   'Kate Jackson',      'Content Strategist',  'Marketing'),
            (12, 'liam@paraslace.in',   'Liam Harris',       'Growth Marketer',     'Marketing'),
            (13, 'mia@paraslace.in',    'Mia Martin',        'Brand Designer',      'Marketing'),
            (14, 'noah@paraslace.in',   'Noah Garcia',       'Product Lead',        'Product'),
            (15, 'olivia@paraslace.in', 'Olivia Lee',        'Product Manager',     'Product'),
            (16, 'peter@paraslace.in',  'Peter Clark',       'Product Analyst',     'Product'),
            (17, 'quinn@paraslace.in',  'Quinn Rodriguez',   'Product Designer',    'Product'),
            (18, 'rachel@paraslace.in', 'Rachel Lewis',      'QA Lead',             'QA'),
            (19, 'sam@paraslace.in',    'Sam Robinson',      'QA Engineer',         'QA'),
            (20, 'tara@paraslace.in',   'Tara Walker',       'Automation QA',       'QA')
    ),
    inserted AS (
        INSERT INTO users (id, email, name, password_hash, role, tenant_id,
                           onboarding_completed, job_title, department)
        SELECT gen_random_uuid(), email, full_name, v_pass_hash,
               'member'::user_role, v_tenant_id, true, job_title, dept
        FROM user_data
        RETURNING id, email
    )
    INSERT INTO _su (seq, uid)
    SELECT ud.seq, ins.id
    FROM user_data ud JOIN inserted ins ON ud.email = ins.email;

    -- All 20 users join the workspace
    INSERT INTO workspace_members (workspace_id, user_id, role)
    SELECT v_workspace_id, uid, 'member'::workspace_member_role
    FROM _su WHERE seq >= 2
    ON CONFLICT DO NOTHING;

    -- Fix admin1 workspace role to owner if not already
    UPDATE workspace_members SET role = 'owner' WHERE workspace_id = v_workspace_id
        AND user_id = (SELECT uid FROM _su WHERE seq = 1);

    -- =========================================================================
    -- TEAMS (5)
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 1;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Engineering', 'Software development team',
            '#3b82f6', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 1 AND 5;

    SELECT uid INTO v_uid FROM _su WHERE seq = 6;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Design', 'UX/UI design team',
            '#8b5cf6', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 6 AND 9;

    SELECT uid INTO v_uid FROM _su WHERE seq = 10;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Marketing', 'Growth and content team',
            '#10b981', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 10 AND 13;

    SELECT uid INTO v_uid FROM _su WHERE seq = 14;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Product', 'Product management team',
            '#f59e0b', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 14 AND 17;

    SELECT uid INTO v_uid FROM _su WHERE seq = 18;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'QA', 'Quality assurance team',
            '#ef4444', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 18 AND 20;

    -- =========================================================================
    -- PROJECT 1: Engineering Tasks
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 1;

    INSERT INTO projects (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Engineering Tasks', 'Task tracking and execution',
            v_workspace_id, v_tenant_id, v_uid, 'ENG')
    RETURNING id INTO v_pid;
    INSERT INTO _sb VALUES (1, v_pid);

    INSERT INTO project_members (project_id, user_id, role)
    SELECT v_pid, uid, 'editor' FROM _su WHERE seq BETWEEN 1 AND 5;

    INSERT INTO _ss (pid, seq, sid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_statuses WHERE project_id = v_pid ORDER BY position;

    SELECT COUNT(*) INTO v_status_count FROM _ss WHERE pid = v_pid;
    IF v_status_count != 5 THEN
        RAISE EXCEPTION 'Expected 5 trigger-created statuses for project 1, got %', v_status_count;
    END IF;

    SELECT id INTO v_gid FROM task_lists WHERE project_id = v_pid AND is_default = true;
    IF v_gid IS NULL THEN
        RAISE EXCEPTION 'Default task list not found for project 1';
    END IF;
    INSERT INTO _sg VALUES (v_pid, 1, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Phase 1', '#3b82f6', 'b0', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 2, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Phase 2', '#8b5cf6', 'b1', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 3, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Backlog', '#94a3b8', 'b2', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 4, v_gid);

    INSERT INTO milestones (id, name, description, due_date, color, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Phase 1 Release', 'First phase delivery',
         now() + interval '14 days', '#3b82f6', v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Phase 2 Release', 'Second phase delivery',
         now() + interval '28 days', '#8b5cf6', v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'MVP Launch', 'Minimum viable product',
         now() + interval '60 days', '#10b981', v_pid, v_tenant_id, v_uid);
    INSERT INTO _sm (pid, seq, mid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO labels (id, name, color, project_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Bug',         '#ef4444', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Feature',     '#3b82f6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Enhancement', '#10b981', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',    '#8b5cf6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Blocker',     '#f59e0b', v_pid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (pid, seq, lid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO project_custom_fields (id, name, field_type, position, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Story Points', 'number', 0, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Phase',        'text',   1, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'PR URL',       'text',   2, v_pid, v_tenant_id, v_uid);
    INSERT INTO _sf (pid, seq, fid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_custom_fields WHERE project_id = v_pid ORDER BY position;

    -- =========================================================================
    -- PROJECT 2: Design System
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 6;

    INSERT INTO projects (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Design System', 'UI component library',
            v_workspace_id, v_tenant_id, v_uid, 'DSN')
    RETURNING id INTO v_pid;
    INSERT INTO _sb VALUES (2, v_pid);

    INSERT INTO project_members (project_id, user_id, role)
    SELECT v_pid, uid, 'editor' FROM _su WHERE seq BETWEEN 6 AND 9;
    -- Ensure admin1 is a member of every project
    INSERT INTO project_members (project_id, user_id, role)
    SELECT v_pid, uid, 'editor' FROM _su WHERE seq = 1
    ON CONFLICT DO NOTHING;

    INSERT INTO _ss (pid, seq, sid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_statuses WHERE project_id = v_pid ORDER BY position;

    SELECT COUNT(*) INTO v_status_count FROM _ss WHERE pid = v_pid;
    IF v_status_count != 5 THEN
        RAISE EXCEPTION 'Expected 5 trigger-created statuses for project 2, got %', v_status_count;
    END IF;

    SELECT id INTO v_gid FROM task_lists WHERE project_id = v_pid AND is_default = true;
    IF v_gid IS NULL THEN
        RAISE EXCEPTION 'Default task list not found for project 2';
    END IF;
    INSERT INTO _sg VALUES (v_pid, 1, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Components', '#8b5cf6', 'b0', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 2, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Tokens', '#3b82f6', 'b1', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 3, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Documentation', '#94a3b8', 'b2', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 4, v_gid);

    INSERT INTO milestones (id, name, due_date, color, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Design System v1.0',
         now() + interval '30 days', '#8b5cf6', v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Design System v2.0',
         now() + interval '90 days', '#3b82f6', v_pid, v_tenant_id, v_uid);
    INSERT INTO _sm (pid, seq, mid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO labels (id, name, color, project_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Bug',       '#ef4444', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Component', '#8b5cf6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Token',     '#3b82f6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',  '#10b981', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Blocker',   '#f59e0b', v_pid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (pid, seq, lid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO project_custom_fields (id, name, field_type, position, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Component Type', 'text',   0, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Priority Score', 'number', 1, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Figma URL',      'text',   2, v_pid, v_tenant_id, v_uid);
    INSERT INTO _sf (pid, seq, fid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_custom_fields WHERE project_id = v_pid ORDER BY position;

    -- =========================================================================
    -- PROJECT 3: Marketing Hub
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 10;

    INSERT INTO projects (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Marketing Hub', 'Campaigns and content',
            v_workspace_id, v_tenant_id, v_uid, 'MKT')
    RETURNING id INTO v_pid;
    INSERT INTO _sb VALUES (3, v_pid);

    INSERT INTO project_members (project_id, user_id, role)
    SELECT v_pid, uid, 'editor' FROM _su WHERE seq BETWEEN 10 AND 13;
    INSERT INTO project_members (project_id, user_id, role)
    SELECT v_pid, uid, 'editor' FROM _su WHERE seq = 1
    ON CONFLICT DO NOTHING;

    INSERT INTO _ss (pid, seq, sid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_statuses WHERE project_id = v_pid ORDER BY position;

    SELECT COUNT(*) INTO v_status_count FROM _ss WHERE pid = v_pid;
    IF v_status_count != 5 THEN
        RAISE EXCEPTION 'Expected 5 trigger-created statuses for project 3, got %', v_status_count;
    END IF;

    SELECT id INTO v_gid FROM task_lists WHERE project_id = v_pid AND is_default = true;
    IF v_gid IS NULL THEN
        RAISE EXCEPTION 'Default task list not found for project 3';
    END IF;
    INSERT INTO _sg VALUES (v_pid, 1, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Campaigns', '#10b981', 'b0', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 2, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Content', '#3b82f6', 'b1', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 3, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Events', '#f59e0b', 'b2', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 4, v_gid);

    INSERT INTO milestones (id, name, due_date, color, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Q1 Campaign',  now() + interval '45 days',  '#10b981', v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Q2 Campaign',  now() + interval '90 days',  '#3b82f6', v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Annual Event', now() + interval '180 days', '#f59e0b', v_pid, v_tenant_id, v_uid);
    INSERT INTO _sm (pid, seq, mid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO labels (id, name, color, project_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Campaign',  '#10b981', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Content',   '#3b82f6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Social',    '#8b5cf6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',  '#f59e0b', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Urgent',    '#ef4444', v_pid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (pid, seq, lid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO project_custom_fields (id, name, field_type, position, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Campaign Type', 'text',   0, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Budget',        'number', 1, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Launch URL',    'text',   2, v_pid, v_tenant_id, v_uid);
    INSERT INTO _sf (pid, seq, fid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_custom_fields WHERE project_id = v_pid ORDER BY position;

    -- =========================================================================
    -- PROJECT 4: Product Roadmap
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 14;

    INSERT INTO projects (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Product Roadmap', 'Feature planning and releases',
            v_workspace_id, v_tenant_id, v_uid, 'PRD')
    RETURNING id INTO v_pid;
    INSERT INTO _sb VALUES (4, v_pid);

    INSERT INTO project_members (project_id, user_id, role)
    SELECT v_pid, uid, 'editor' FROM _su WHERE seq BETWEEN 14 AND 17;
    INSERT INTO project_members (project_id, user_id, role)
    SELECT v_pid, uid, 'editor' FROM _su WHERE seq = 1
    ON CONFLICT DO NOTHING;

    INSERT INTO _ss (pid, seq, sid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_statuses WHERE project_id = v_pid ORDER BY position;

    SELECT COUNT(*) INTO v_status_count FROM _ss WHERE pid = v_pid;
    IF v_status_count != 5 THEN
        RAISE EXCEPTION 'Expected 5 trigger-created statuses for project 4, got %', v_status_count;
    END IF;

    SELECT id INTO v_gid FROM task_lists WHERE project_id = v_pid AND is_default = true;
    IF v_gid IS NULL THEN
        RAISE EXCEPTION 'Default task list not found for project 4';
    END IF;
    INSERT INTO _sg VALUES (v_pid, 1, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Q1', '#3b82f6', 'b0', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 2, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Q2', '#8b5cf6', 'b1', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 3, v_gid);

    INSERT INTO task_lists (id, name, color, position, project_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Q3', '#10b981', 'b2', v_pid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_pid, 4, v_gid);

    INSERT INTO milestones (id, name, due_date, color, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Q1 Release',  now() + interval '30 days', '#3b82f6', v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Beta Launch', now() + interval '45 days', '#f59e0b', v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Q2 Release',  now() + interval '90 days', '#8b5cf6', v_pid, v_tenant_id, v_uid);
    INSERT INTO _sm (pid, seq, mid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO labels (id, name, color, project_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Feature',     '#3b82f6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Enhancement', '#10b981', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',    '#8b5cf6', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Bug',         '#ef4444', v_pid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Blocker',     '#f59e0b', v_pid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (pid, seq, lid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE project_id = v_pid ORDER BY created_at;

    INSERT INTO project_custom_fields (id, name, field_type, position, project_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Feature Size', 'text',   0, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Confidence',   'number', 1, v_pid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'PRD URL',      'text',   2, v_pid, v_tenant_id, v_uid);
    INSERT INTO _sf (pid, seq, fid)
    SELECT v_pid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM project_custom_fields WHERE project_id = v_pid ORDER BY position;

    RAISE NOTICE 'Projects, statuses, task lists, milestones, labels, custom fields ready. Generating 500 tasks...';

    -- =========================================================================
    -- TASKS (500 total: 125 per project)
    -- =========================================================================
    FOR p IN 1..4 LOOP
        SELECT pid INTO v_pid FROM _sb WHERE seq = p;
        v_start_user := team_starts[p];
        v_team_size  := team_sizes[p];
        v_mile_count := CASE p WHEN 2 THEN 2 ELSE 3 END;

        FOR i IN 1..125 LOOP
            v_global_seq := (p - 1) * 125 + i;

            v_priority := CASE
                WHEN v_global_seq <= 50  THEN 'urgent'::task_priority
                WHEN v_global_seq <= 175 THEN 'high'::task_priority
                WHEN v_global_seq <= 375 THEN 'medium'::task_priority
                ELSE                          'low'::task_priority
            END;

            SELECT sid INTO v_sid
            FROM _ss WHERE pid = v_pid AND seq = ((i - 1) % 5) + 1;

            SELECT gid INTO v_gid
            FROM _sg WHERE pid = v_pid AND seq = ((i - 1) % 4) + 1;

            SELECT uid INTO v_uid
            FROM _su WHERE seq = v_start_user + ((i - 1) % v_team_size);

            IF i % 5 != 0 THEN
                SELECT mid INTO v_mid
                FROM _sm WHERE pid = v_pid
                  AND seq = ((i - 1) % v_mile_count) + 1;
            ELSE
                v_mid := NULL;
            END IF;

            v_title := CASE p
                WHEN 1 THEN eng_actions[((i - 1) % 10) + 1] || ' ' || eng_subjects[((i - 1) % 15) + 1]
                WHEN 2 THEN des_actions[((i - 1) % 10) + 1] || ' ' || des_subjects[((i - 1) % 15) + 1]
                WHEN 3 THEN mkt_actions[((i - 1) % 10) + 1] || ' ' || mkt_subjects[((i - 1) % 15) + 1]
                ELSE        prd_actions[((i - 1) % 10) + 1] || ' ' || prd_subjects[((i - 1) % 15) + 1]
            END;

            v_due := (now() + ((i - 20) * interval '1 day'))::DATE;

            INSERT INTO tasks (
                id, title, description, priority,
                project_id, status_id, task_list_id,
                position, task_number,
                tenant_id, created_by_id,
                milestone_id, due_date, estimated_hours
            ) VALUES (
                gen_random_uuid(),
                v_title,
                'Task ' || v_global_seq || ' — part of the '
                    || CASE p
                        WHEN 1 THEN 'engineering task workflow'
                        WHEN 2 THEN 'design system workflow'
                        WHEN 3 THEN 'marketing hub workflow'
                        ELSE        'product roadmap workflow'
                       END || '.',
                v_priority,
                v_pid, v_sid, v_gid,
                'a' || lpad(i::TEXT, 5, '0'),
                i,
                v_tenant_id, v_uid,
                v_mid,
                v_due,
                CASE WHEN i % 3 = 0 THEN (1 + (i % 13))::DOUBLE PRECISION ELSE NULL END
            )
            RETURNING id INTO v_tid;

            INSERT INTO _st (seq, tid, pid) VALUES (v_global_seq, v_tid, v_pid);

            INSERT INTO task_assignees (task_id, user_id) VALUES (v_tid, v_uid);

            IF i % 2 = 0 THEN
                SELECT uid INTO v_uid2
                FROM _su WHERE seq = v_start_user + (i % v_team_size);
                IF v_uid2 IS DISTINCT FROM v_uid THEN
                    INSERT INTO task_assignees (task_id, user_id)
                    VALUES (v_tid, v_uid2)
                    ON CONFLICT DO NOTHING;
                END IF;
            END IF;
        END LOOP;

        RAISE NOTICE 'Project % — 125 tasks created.', p;
    END LOOP;

    RAISE NOTICE 'All 500 tasks created. Adding subtasks, comments, watchers, deps, time entries, labels...';

    -- =========================================================================
    -- SUBTASKS
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 1;
    FOR i IN 1..500 LOOP
        IF i % 10 = 0 THEN
            SELECT tid INTO v_tid FROM _st WHERE seq = i;
            INSERT INTO subtasks (id, title, is_completed, position, task_id, created_by_id)
            VALUES
                (gen_random_uuid(), 'Research and define requirements', false, 'a0', v_tid, v_uid),
                (gen_random_uuid(), 'Implement the solution',           false, 'a1', v_tid, v_uid);
            IF i % 30 = 0 THEN
                INSERT INTO subtasks (id, title, is_completed, position, task_id, created_by_id)
                VALUES (gen_random_uuid(), 'Write tests and review', false, 'a2', v_tid, v_uid);
            END IF;
        END IF;
    END LOOP;

    -- =========================================================================
    -- COMMENTS
    -- =========================================================================
    FOR i IN 1..500 LOOP
        IF i % 6 = 0 OR (i % 7 = 0 AND i % 6 != 0) THEN
            SELECT tid INTO v_tid FROM _st WHERE seq = i;
            SELECT uid INTO v_uid FROM _su WHERE seq = ((i % 20) + 1);
            INSERT INTO comments (id, content, task_id, author_id)
            VALUES (
                gen_random_uuid(),
                CASE (i % 5)
                    WHEN 0 THEN 'Updated the implementation based on the latest feedback. Looks good to merge!'
                    WHEN 1 THEN 'Found a potential issue with the approach. Need to discuss in the next standup.'
                    WHEN 2 THEN 'Completed the initial draft. Please review when you have time.'
                    WHEN 3 THEN 'Added unit tests. Coverage is now at 85%. Ready for review.'
                    ELSE        'Blocked by dependency on API changes. Will resume once that merges.'
                END,
                v_tid, v_uid
            );
        END IF;
    END LOOP;

    -- =========================================================================
    -- TASK WATCHERS
    -- =========================================================================
    FOR i IN 1..500 LOOP
        IF i % 8 = 0 THEN
            SELECT tid INTO v_tid FROM _st WHERE seq = i;
            SELECT uid INTO v_uid FROM _su WHERE seq = 18 + ((i / 8) % 3);
            INSERT INTO task_watchers (task_id, user_id)
            VALUES (v_tid, v_uid)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- =========================================================================
    -- TASK DEPENDENCIES (30 pairs)
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 1;
    FOR i IN 1..30 LOOP
        SELECT tid INTO v_src FROM _st WHERE seq = i * 16;
        SELECT tid INTO v_tgt FROM _st WHERE seq = i * 16 + 3;
        v_dep_type := CASE (i % 3)
            WHEN 0 THEN 'blocks'::dependency_type
            WHEN 1 THEN 'related'::dependency_type
            ELSE        'blocked_by'::dependency_type
        END;
        IF v_src IS NOT NULL AND v_tgt IS NOT NULL AND v_src != v_tgt THEN
            INSERT INTO task_dependencies (
                source_task_id, target_task_id, dependency_type, created_by_id
            ) VALUES (v_src, v_tgt, v_dep_type, v_uid)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- =========================================================================
    -- TIME ENTRIES (40)
    -- =========================================================================
    FOR i IN 1..40 LOOP
        SELECT tid, pid INTO v_tid, v_pid FROM _st WHERE seq = i * 12;
        SELECT uid INTO v_uid FROM _su WHERE seq = ((i % 17) + 1);
        IF v_tid IS NOT NULL THEN
            INSERT INTO time_entries (
                id, task_id, user_id, description,
                started_at, ended_at, duration_minutes,
                is_running, project_id, tenant_id, is_billable
            ) VALUES (
                gen_random_uuid(),
                v_tid, v_uid,
                'Work session ' || i,
                now() - ((41 - i) * interval '1 day') - interval '2 hours',
                now() - ((41 - i) * interval '1 day'),
                120 + (i % 180),
                false,
                v_pid,
                v_tenant_id,
                (i % 3 = 0)
            );
        END IF;
    END LOOP;

    -- =========================================================================
    -- TASK LABELS
    -- =========================================================================
    FOR i IN 1..500 LOOP
        IF i % 4 != 0 THEN
            SELECT tid, pid INTO v_tid, v_pid FROM _st WHERE seq = i;
            SELECT lid INTO v_lid FROM _sl
            WHERE pid = v_pid AND seq = ((i - 1) % 5) + 1;
            INSERT INTO task_labels (task_id, label_id)
            VALUES (v_tid, v_lid)
            ON CONFLICT DO NOTHING;
            IF i % 3 = 0 THEN
                SELECT lid INTO v_lid FROM _sl
                WHERE pid = v_pid AND seq = (i % 5) + 1;
                INSERT INTO task_labels (task_id, label_id)
                VALUES (v_tid, v_lid)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE '=== Paraslace seed complete! ===';
    RAISE NOTICE 'Users: 20 (admin1@paraslace.in = admin, 19 new @paraslace.in members)';
    RAISE NOTICE 'Projects: 4 (Engineering Tasks, Design System, Marketing Hub, Product Roadmap)';
    RAISE NOTICE 'Tasks: 500 with assignees, labels, milestones, subtasks, comments, watchers, deps, time entries';
    RAISE NOTICE 'All new accounts share admin1 password.';
END $$;

DROP TABLE IF EXISTS _su, _sb, _ss, _sg, _sm, _sl, _sf, _st;
