-- =============================================================================
-- TaskFlow Seed Data: Acme Corp (20 employees, 500 tasks, 4 boards)
-- =============================================================================
-- Usage: run_seed.sh injects the hash via:
--   printf "SET session.pass_hash='%s';\n" "$HASH" | cat - seed_data.sql | psql
-- The DO block reads it with: current_setting('session.pass_hash')
-- =============================================================================

\set ON_ERROR_STOP on

-- Temp tables to track generated IDs during the seed run
CREATE TEMP TABLE IF NOT EXISTS _su (seq INT PRIMARY KEY, uid UUID NOT NULL);
CREATE TEMP TABLE IF NOT EXISTS _sb (seq INT PRIMARY KEY, bid UUID NOT NULL);
CREATE TEMP TABLE IF NOT EXISTS _sc (bid UUID, seq INT, cid UUID, PRIMARY KEY (bid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sg (bid UUID, seq INT, gid UUID, PRIMARY KEY (bid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sm (bid UUID, seq INT, mid UUID, PRIMARY KEY (bid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sl (bid UUID, seq INT, lid UUID, PRIMARY KEY (bid, seq));
CREATE TEMP TABLE IF NOT EXISTS _sf (bid UUID, seq INT, fid UUID, PRIMARY KEY (bid, seq));
CREATE TEMP TABLE IF NOT EXISTS _st (seq INT PRIMARY KEY, tid UUID NOT NULL, bid UUID NOT NULL);

DO $$
DECLARE
    -- Core IDs
    v_tenant_id     UUID;
    v_workspace_id  UUID;
    v_pass_hash     TEXT := current_setting('session.pass_hash');

    -- Working variables
    v_id            UUID;
    v_bid           UUID;
    v_cid           UUID;
    v_gid           UUID;
    v_mid           UUID;
    v_lid           UUID;
    v_tid           UUID;
    v_uid           UUID;
    v_uid2          UUID;
    v_src           UUID;
    v_tgt           UUID;

    -- Loop counters
    i               INTEGER;
    b               INTEGER;

    -- Task generation state
    v_global_seq    INTEGER;
    v_priority      task_priority;
    v_dep_type      dependency_type;
    v_title         TEXT;
    v_due           DATE;
    v_mile_count    INTEGER;
    v_start_user    INTEGER;
    v_team_size     INTEGER;

    -- Team membership ranges per board (Engineering=1-5, Design=6-9, Mkt=10-13, Product=14-17)
    team_starts     INTEGER[] := ARRAY[1, 6, 10, 14];
    team_sizes      INTEGER[] := ARRAY[5, 4,  4,  4];

    -- Task title vocabulary: actions and subjects per board
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
    -- IDEMPOTENCY CHECK
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM tenants WHERE slug = 'acme-seed') THEN
        RAISE NOTICE 'Seed data already exists (slug=acme-seed). Run with --force to recreate.';
        RETURN;
    END IF;

    RAISE NOTICE 'Creating Acme Corp seed data...';

    -- =========================================================================
    -- TENANT
    -- =========================================================================
    INSERT INTO tenants (id, name, slug, plan)
    VALUES (gen_random_uuid(), 'Acme Corp', 'acme-seed', 'free')
    RETURNING id INTO v_tenant_id;

    -- =========================================================================
    -- USERS (20)
    --   Seq  1    = alice  → Admin, Engineering Lead
    --   Seq  2-5  = Engineering team
    --   Seq  6-9  = Design team
    --   Seq 10-13 = Marketing team
    --   Seq 14-17 = Product team
    --   Seq 18-20 = QA team
    -- =========================================================================
    WITH user_data(seq, email, full_name, job_title, dept) AS (
        VALUES
            (1,  'alice@acme.com',  'Alice Johnson',    'Engineering Lead',    'Engineering'),
            (2,  'bob@acme.com',    'Bob Smith',         'Senior Engineer',     'Engineering'),
            (3,  'carol@acme.com',  'Carol White',       'Backend Engineer',    'Engineering'),
            (4,  'david@acme.com',  'David Brown',       'Frontend Engineer',   'Engineering'),
            (5,  'emma@acme.com',   'Emma Davis',        'DevOps Engineer',     'Engineering'),
            (6,  'frank@acme.com',  'Frank Miller',      'Design Lead',         'Design'),
            (7,  'grace@acme.com',  'Grace Wilson',      'UI Designer',         'Design'),
            (8,  'henry@acme.com',  'Henry Taylor',      'UX Researcher',       'Design'),
            (9,  'iris@acme.com',   'Iris Anderson',     'Visual Designer',     'Design'),
            (10, 'james@acme.com',  'James Thomas',      'Marketing Lead',      'Marketing'),
            (11, 'kate@acme.com',   'Kate Jackson',      'Content Strategist',  'Marketing'),
            (12, 'liam@acme.com',   'Liam Harris',       'Growth Marketer',     'Marketing'),
            (13, 'mia@acme.com',    'Mia Martin',        'Brand Designer',      'Marketing'),
            (14, 'noah@acme.com',   'Noah Garcia',       'Product Lead',        'Product'),
            (15, 'olivia@acme.com', 'Olivia Lee',        'Product Manager',     'Product'),
            (16, 'peter@acme.com',  'Peter Clark',       'Product Analyst',     'Product'),
            (17, 'quinn@acme.com',  'Quinn Rodriguez',   'Product Designer',    'Product'),
            (18, 'rachel@acme.com', 'Rachel Lewis',      'QA Lead',             'QA'),
            (19, 'sam@acme.com',    'Sam Robinson',      'QA Engineer',         'QA'),
            (20, 'tara@acme.com',   'Tara Walker',       'Automation QA',       'QA')
    ),
    inserted AS (
        INSERT INTO users (id, email, name, password_hash, role, tenant_id,
                           onboarding_completed, job_title, department)
        SELECT gen_random_uuid(), email, full_name, v_pass_hash,
               CASE WHEN seq = 1 THEN 'admin'::user_role ELSE 'member'::user_role END,
               v_tenant_id, true, job_title, dept
        FROM user_data
        RETURNING id, email
    )
    INSERT INTO _su (seq, uid)
    SELECT ud.seq, ins.id
    FROM user_data ud JOIN inserted ins ON ud.email = ins.email;

    -- =========================================================================
    -- WORKSPACE
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 1;

    INSERT INTO workspaces (id, name, description, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Acme Workspace', 'Main workspace for Acme Corp',
            v_tenant_id, v_uid)
    RETURNING id INTO v_workspace_id;

    -- All 20 users join the workspace; alice is owner
    INSERT INTO workspace_members (workspace_id, user_id, role)
    SELECT v_workspace_id, uid,
           CASE WHEN seq = 1 THEN 'owner'::workspace_member_role
                ELSE 'member'::workspace_member_role END
    FROM _su;

    -- =========================================================================
    -- TEAMS (5)
    -- =========================================================================
    -- Engineering (users 1-5)
    SELECT uid INTO v_uid FROM _su WHERE seq = 1;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Engineering', 'Software development team',
            '#3b82f6', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 1 AND 5;

    -- Design (users 6-9)
    SELECT uid INTO v_uid FROM _su WHERE seq = 6;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Design', 'UX/UI design team',
            '#8b5cf6', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 6 AND 9;

    -- Marketing (users 10-13)
    SELECT uid INTO v_uid FROM _su WHERE seq = 10;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Marketing', 'Growth and content team',
            '#10b981', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 10 AND 13;

    -- Product (users 14-17)
    SELECT uid INTO v_uid FROM _su WHERE seq = 14;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'Product', 'Product management team',
            '#f59e0b', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 14 AND 17;

    -- QA (users 18-20)
    SELECT uid INTO v_uid FROM _su WHERE seq = 18;
    INSERT INTO teams (id, name, description, color, workspace_id, created_by_id)
    VALUES (gen_random_uuid(), 'QA', 'Quality assurance team',
            '#ef4444', v_workspace_id, v_uid)
    RETURNING id INTO v_id;
    INSERT INTO team_members (team_id, user_id)
    SELECT v_id, uid FROM _su WHERE seq BETWEEN 18 AND 20;

    -- =========================================================================
    -- BOARD 1: Engineering Sprints
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 1;

    INSERT INTO boards (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Engineering Sprints', 'Sprint planning and execution',
            v_workspace_id, v_tenant_id, v_uid, 'ENG')
    RETURNING id INTO v_bid;
    INSERT INTO _sb VALUES (1, v_bid);

    -- Add all eng team as board members
    INSERT INTO board_members (board_id, user_id, role)
    SELECT v_bid, uid, 'editor' FROM _su WHERE seq BETWEEN 1 AND 5;

    -- Columns
    INSERT INTO board_columns (id, name, board_id, position, color, status_mapping) VALUES
        (gen_random_uuid(), 'Todo',        v_bid, 'a0', '#64748b', '{"status":"todo"}'),
        (gen_random_uuid(), 'In Progress', v_bid, 'a1', '#3b82f6', '{"status":"in_progress"}'),
        (gen_random_uuid(), 'Review',      v_bid, 'a2', '#f59e0b', '{"status":"in_review"}'),
        (gen_random_uuid(), 'Done',        v_bid, 'a3', '#10b981', '{"status":"done"}');
    INSERT INTO _sc (bid, seq, cid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_columns WHERE board_id = v_bid ORDER BY position;

    -- Groups: fetch auto-created "Ungrouped", then add Sprint 1, Sprint 2, Backlog
    SELECT id INTO v_gid FROM task_groups WHERE board_id = v_bid AND name = 'Ungrouped';
    INSERT INTO _sg VALUES (v_bid, 1, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Sprint 1', '#3b82f6', 'b0', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 2, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Sprint 2', '#8b5cf6', 'b1', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 3, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Backlog', '#94a3b8', 'b2', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 4, v_gid);

    -- Milestones (3)
    INSERT INTO milestones (id, name, description, due_date, color, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Sprint 1 Release', 'First sprint delivery',
         now() + interval '14 days', '#3b82f6', v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Sprint 2 Release', 'Second sprint delivery',
         now() + interval '28 days', '#8b5cf6', v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'MVP Launch', 'Minimum viable product',
         now() + interval '60 days', '#10b981', v_bid, v_tenant_id, v_uid);
    INSERT INTO _sm (bid, seq, mid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE board_id = v_bid ORDER BY created_at;

    -- Labels (5)
    INSERT INTO labels (id, name, color, board_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Bug',         '#ef4444', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Feature',     '#3b82f6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Enhancement', '#10b981', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',    '#8b5cf6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Blocker',     '#f59e0b', v_bid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (bid, seq, lid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE board_id = v_bid ORDER BY created_at;

    -- Custom fields (3)
    INSERT INTO board_custom_fields (id, name, field_type, position, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Story Points', 'number', 0, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Sprint',       'text',   1, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'PR URL',       'text',   2, v_bid, v_tenant_id, v_uid);
    INSERT INTO _sf (bid, seq, fid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_custom_fields WHERE board_id = v_bid ORDER BY position;

    -- =========================================================================
    -- BOARD 2: Design System
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 6;

    INSERT INTO boards (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Design System', 'UI component library',
            v_workspace_id, v_tenant_id, v_uid, 'DSN')
    RETURNING id INTO v_bid;
    INSERT INTO _sb VALUES (2, v_bid);

    INSERT INTO board_members (board_id, user_id, role)
    SELECT v_bid, uid, 'editor' FROM _su WHERE seq BETWEEN 6 AND 9;

    INSERT INTO board_columns (id, name, board_id, position, color, status_mapping) VALUES
        (gen_random_uuid(), 'Backlog',   v_bid, 'a0', '#64748b', '{"status":"todo"}'),
        (gen_random_uuid(), 'In Design', v_bid, 'a1', '#8b5cf6', '{"status":"in_progress"}'),
        (gen_random_uuid(), 'Review',    v_bid, 'a2', '#f59e0b', '{"status":"in_review"}'),
        (gen_random_uuid(), 'Published', v_bid, 'a3', '#10b981', '{"status":"done"}');
    INSERT INTO _sc (bid, seq, cid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_columns WHERE board_id = v_bid ORDER BY position;

    SELECT id INTO v_gid FROM task_groups WHERE board_id = v_bid AND name = 'Ungrouped';
    INSERT INTO _sg VALUES (v_bid, 1, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Components', '#8b5cf6', 'b0', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 2, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Tokens', '#3b82f6', 'b1', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 3, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Documentation', '#94a3b8', 'b2', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 4, v_gid);

    INSERT INTO milestones (id, name, due_date, color, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Design System v1.0',
         now() + interval '30 days', '#8b5cf6', v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Design System v2.0',
         now() + interval '90 days', '#3b82f6', v_bid, v_tenant_id, v_uid);
    INSERT INTO _sm (bid, seq, mid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE board_id = v_bid ORDER BY created_at;

    INSERT INTO labels (id, name, color, board_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Bug',       '#ef4444', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Component', '#8b5cf6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Token',     '#3b82f6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',  '#10b981', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Blocker',   '#f59e0b', v_bid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (bid, seq, lid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE board_id = v_bid ORDER BY created_at;

    INSERT INTO board_custom_fields (id, name, field_type, position, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Component Type', 'text',   0, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Priority Score', 'number', 1, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Figma URL',      'text',   2, v_bid, v_tenant_id, v_uid);
    INSERT INTO _sf (bid, seq, fid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_custom_fields WHERE board_id = v_bid ORDER BY position;

    -- =========================================================================
    -- BOARD 3: Marketing Hub
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 10;

    INSERT INTO boards (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Marketing Hub', 'Campaigns and content',
            v_workspace_id, v_tenant_id, v_uid, 'MKT')
    RETURNING id INTO v_bid;
    INSERT INTO _sb VALUES (3, v_bid);

    INSERT INTO board_members (board_id, user_id, role)
    SELECT v_bid, uid, 'editor' FROM _su WHERE seq BETWEEN 10 AND 13;

    INSERT INTO board_columns (id, name, board_id, position, color, status_mapping) VALUES
        (gen_random_uuid(), 'Ideas',       v_bid, 'a0', '#64748b', '{"status":"todo"}'),
        (gen_random_uuid(), 'In Progress', v_bid, 'a1', '#3b82f6', '{"status":"in_progress"}'),
        (gen_random_uuid(), 'Approval',    v_bid, 'a2', '#f59e0b', '{"status":"in_review"}'),
        (gen_random_uuid(), 'Live',        v_bid, 'a3', '#10b981', '{"status":"done"}');
    INSERT INTO _sc (bid, seq, cid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_columns WHERE board_id = v_bid ORDER BY position;

    SELECT id INTO v_gid FROM task_groups WHERE board_id = v_bid AND name = 'Ungrouped';
    INSERT INTO _sg VALUES (v_bid, 1, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Campaigns', '#10b981', 'b0', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 2, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Content', '#3b82f6', 'b1', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 3, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Events', '#f59e0b', 'b2', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 4, v_gid);

    INSERT INTO milestones (id, name, due_date, color, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Q1 Campaign',  now() + interval '45 days',  '#10b981', v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Q2 Campaign',  now() + interval '90 days',  '#3b82f6', v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Annual Event', now() + interval '180 days', '#f59e0b', v_bid, v_tenant_id, v_uid);
    INSERT INTO _sm (bid, seq, mid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE board_id = v_bid ORDER BY created_at;

    INSERT INTO labels (id, name, color, board_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Campaign',  '#10b981', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Content',   '#3b82f6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Social',    '#8b5cf6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',  '#f59e0b', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Urgent',    '#ef4444', v_bid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (bid, seq, lid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE board_id = v_bid ORDER BY created_at;

    INSERT INTO board_custom_fields (id, name, field_type, position, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Campaign Type', 'text',   0, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Budget',        'number', 1, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Launch URL',    'text',   2, v_bid, v_tenant_id, v_uid);
    INSERT INTO _sf (bid, seq, fid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_custom_fields WHERE board_id = v_bid ORDER BY position;

    -- =========================================================================
    -- BOARD 4: Product Roadmap
    -- =========================================================================
    SELECT uid INTO v_uid FROM _su WHERE seq = 14;

    INSERT INTO boards (id, name, description, workspace_id, tenant_id, created_by_id, prefix)
    VALUES (gen_random_uuid(), 'Product Roadmap', 'Feature planning and releases',
            v_workspace_id, v_tenant_id, v_uid, 'PRD')
    RETURNING id INTO v_bid;
    INSERT INTO _sb VALUES (4, v_bid);

    INSERT INTO board_members (board_id, user_id, role)
    SELECT v_bid, uid, 'editor' FROM _su WHERE seq BETWEEN 14 AND 17;

    INSERT INTO board_columns (id, name, board_id, position, color, status_mapping) VALUES
        (gen_random_uuid(), 'Planned',        v_bid, 'a0', '#64748b', '{"status":"todo"}'),
        (gen_random_uuid(), 'In Development', v_bid, 'a1', '#3b82f6', '{"status":"in_progress"}'),
        (gen_random_uuid(), 'Beta',           v_bid, 'a2', '#f59e0b', '{"status":"in_review"}'),
        (gen_random_uuid(), 'Released',       v_bid, 'a3', '#10b981', '{"status":"done"}');
    INSERT INTO _sc (bid, seq, cid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_columns WHERE board_id = v_bid ORDER BY position;

    SELECT id INTO v_gid FROM task_groups WHERE board_id = v_bid AND name = 'Ungrouped';
    INSERT INTO _sg VALUES (v_bid, 1, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Q1', '#3b82f6', 'b0', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 2, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Q2', '#8b5cf6', 'b1', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 3, v_gid);

    INSERT INTO task_groups (id, name, color, position, board_id, tenant_id, created_by_id)
    VALUES (gen_random_uuid(), 'Q3', '#10b981', 'b2', v_bid, v_tenant_id, v_uid)
    RETURNING id INTO v_gid;
    INSERT INTO _sg VALUES (v_bid, 4, v_gid);

    INSERT INTO milestones (id, name, due_date, color, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Q1 Release',  now() + interval '30 days', '#3b82f6', v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Beta Launch', now() + interval '45 days', '#f59e0b', v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Q2 Release',  now() + interval '90 days', '#8b5cf6', v_bid, v_tenant_id, v_uid);
    INSERT INTO _sm (bid, seq, mid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM milestones WHERE board_id = v_bid ORDER BY created_at;

    INSERT INTO labels (id, name, color, board_id, workspace_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Feature',     '#3b82f6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Enhancement', '#10b981', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Research',    '#8b5cf6', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Bug',         '#ef4444', v_bid, v_workspace_id, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Blocker',     '#f59e0b', v_bid, v_workspace_id, v_tenant_id, v_uid);
    INSERT INTO _sl (bid, seq, lid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY created_at), id
    FROM labels WHERE board_id = v_bid ORDER BY created_at;

    INSERT INTO board_custom_fields (id, name, field_type, position, board_id, tenant_id, created_by_id)
    VALUES
        (gen_random_uuid(), 'Feature Size', 'text',   0, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'Confidence',   'number', 1, v_bid, v_tenant_id, v_uid),
        (gen_random_uuid(), 'PRD URL',      'text',   2, v_bid, v_tenant_id, v_uid);
    INSERT INTO _sf (bid, seq, fid)
    SELECT v_bid, ROW_NUMBER() OVER (ORDER BY position), id
    FROM board_custom_fields WHERE board_id = v_bid ORDER BY position;

    RAISE NOTICE 'Boards, columns, groups, milestones, labels, custom fields ready. Generating 500 tasks...';

    -- =========================================================================
    -- TASKS (500 total: 125 per board)
    --
    -- Priority distribution (global seq):
    --   1-50   → urgent  (10%)
    --   51-175 → high    (25%)
    --   176-375→ medium  (40%)
    --   376-500→ low     (25%)
    --
    -- Column assignment: round-robin (1..4)
    -- Group assignment:  round-robin (1..4)
    -- Assignee:          rotated through board team
    -- Milestone:         80% of tasks (i % 5 != 0)
    -- =========================================================================
    FOR b IN 1..4 LOOP
        SELECT bid INTO v_bid FROM _sb WHERE seq = b;
        v_start_user := team_starts[b];
        v_team_size  := team_sizes[b];

        -- Number of milestones for this board
        v_mile_count := CASE b WHEN 2 THEN 2 ELSE 3 END;

        FOR i IN 1..125 LOOP
            v_global_seq := (b - 1) * 125 + i;

            -- Priority
            v_priority := CASE
                WHEN v_global_seq <= 50  THEN 'urgent'::task_priority
                WHEN v_global_seq <= 175 THEN 'high'::task_priority
                WHEN v_global_seq <= 375 THEN 'medium'::task_priority
                ELSE                          'low'::task_priority
            END;

            -- Column (round-robin 1..4)
            SELECT cid INTO v_cid
            FROM _sc WHERE bid = v_bid AND seq = ((i - 1) % 4) + 1;

            -- Group (round-robin 1..4)
            SELECT gid INTO v_gid
            FROM _sg WHERE bid = v_bid AND seq = ((i - 1) % 4) + 1;

            -- Creator: rotate through board team
            SELECT uid INTO v_uid
            FROM _su WHERE seq = v_start_user + ((i - 1) % v_team_size);

            -- Milestone: 80% of tasks
            IF i % 5 != 0 THEN
                SELECT mid INTO v_mid
                FROM _sm WHERE bid = v_bid
                  AND seq = ((i - 1) % v_mile_count) + 1;
            ELSE
                v_mid := NULL;
            END IF;

            -- Title
            v_title := CASE b
                WHEN 1 THEN eng_actions[((i - 1) % 10) + 1] || ' ' || eng_subjects[((i - 1) % 15) + 1]
                WHEN 2 THEN des_actions[((i - 1) % 10) + 1] || ' ' || des_subjects[((i - 1) % 15) + 1]
                WHEN 3 THEN mkt_actions[((i - 1) % 10) + 1] || ' ' || mkt_subjects[((i - 1) % 15) + 1]
                ELSE        prd_actions[((i - 1) % 10) + 1] || ' ' || prd_subjects[((i - 1) % 15) + 1]
            END;

            -- Due date: spread -20 to +90 days from now
            v_due := (now() + ((i - 20) * interval '1 day'))::DATE;

            INSERT INTO tasks (
                id, title, description, priority,
                board_id, column_id, group_id,
                position, task_number,
                tenant_id, created_by_id,
                milestone_id, due_date, estimated_hours
            ) VALUES (
                gen_random_uuid(),
                v_title,
                'Task ' || v_global_seq || ' — part of the '
                    || CASE b
                        WHEN 1 THEN 'engineering sprint workflow'
                        WHEN 2 THEN 'design system workflow'
                        WHEN 3 THEN 'marketing hub workflow'
                        ELSE        'product roadmap workflow'
                       END || '.',
                v_priority,
                v_bid, v_cid, v_gid,
                'a' || lpad(i::TEXT, 5, '0'),
                i,
                v_tenant_id, v_uid,
                v_mid,
                v_due,
                CASE WHEN i % 3 = 0 THEN (1 + (i % 13))::DOUBLE PRECISION ELSE NULL END
            )
            RETURNING id INTO v_tid;

            INSERT INTO _st (seq, tid, bid) VALUES (v_global_seq, v_tid, v_bid);

            -- Primary assignee (task creator)
            INSERT INTO task_assignees (task_id, user_id) VALUES (v_tid, v_uid);

            -- Second assignee for every 2nd task
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

        RAISE NOTICE 'Board % — 125 tasks created.', b;
    END LOOP;

    RAISE NOTICE 'All 500 tasks created. Adding subtasks, comments, watchers, deps, time entries, labels...';

    -- =========================================================================
    -- SUBTASKS (~130 total: 50 tasks get 2-3 subtasks)
    -- Tasks at seq % 10 = 0 get subtasks
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
    -- COMMENTS (~80 comments across tasks)
    -- Tasks where (seq % 6 = 0) OR (seq % 7 = 0 AND seq % 6 != 0) get a comment
    -- =========================================================================
    FOR i IN 1..500 LOOP
        IF i % 6 = 0 OR (i % 7 = 0 AND i % 6 != 0) THEN
            SELECT tid INTO v_tid FROM _st WHERE seq = i;
            -- Author: pick a user by round-robin (offset from primary assignee for variety)
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
                v_tid,
                v_uid
            );
        END IF;
    END LOOP;

    -- =========================================================================
    -- TASK WATCHERS (~62 tasks watched)
    -- Every 8th task gets a watcher from a different team
    -- =========================================================================
    FOR i IN 1..500 LOOP
        IF i % 8 = 0 THEN
            SELECT tid INTO v_tid FROM _st WHERE seq = i;
            -- Use QA/cross-team users as watchers (seq 18-20, cycling)
            SELECT uid INTO v_uid FROM _su WHERE seq = 18 + ((i / 8) % 3);

            INSERT INTO task_watchers (task_id, user_id)
            VALUES (v_tid, v_uid)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- =========================================================================
    -- TASK DEPENDENCIES (30 pairs)
    -- Source task at seq = i*16, target at seq = i*16+3
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
            )
            VALUES (v_src, v_tgt, v_dep_type, v_uid)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- =========================================================================
    -- TIME ENTRIES (40 entries)
    -- One entry per every 12th task
    -- =========================================================================
    FOR i IN 1..40 LOOP
        SELECT tid, bid INTO v_tid, v_bid FROM _st WHERE seq = i * 12;
        -- Assign to a user who is a member of that board
        SELECT uid INTO v_uid FROM _su WHERE seq = ((i % 17) + 1);

        IF v_tid IS NOT NULL THEN
            INSERT INTO time_entries (
                id, task_id, user_id, description,
                started_at, ended_at, duration_minutes,
                is_running, board_id, tenant_id
            ) VALUES (
                gen_random_uuid(),
                v_tid, v_uid,
                'Work session ' || i,
                now() - ((41 - i) * interval '1 day') - interval '2 hours',
                now() - ((41 - i) * interval '1 day'),
                120 + (i % 180),
                false,
                v_bid,
                v_tenant_id
            );
        END IF;
    END LOOP;

    -- =========================================================================
    -- TASK LABELS (75% of tasks get 1-2 labels)
    -- Skip every 4th task; 33% of labeled tasks get a second label
    -- =========================================================================
    FOR i IN 1..500 LOOP
        IF i % 4 != 0 THEN
            SELECT tid, bid INTO v_tid, v_bid FROM _st WHERE seq = i;

            -- Primary label
            SELECT lid INTO v_lid FROM _sl
            WHERE bid = v_bid AND seq = ((i - 1) % 5) + 1;
            INSERT INTO task_labels (task_id, label_id)
            VALUES (v_tid, v_lid)
            ON CONFLICT DO NOTHING;

            -- Second label for every 3rd labeled task
            IF i % 3 = 0 THEN
                SELECT lid INTO v_lid FROM _sl
                WHERE bid = v_bid AND seq = (i % 5) + 1;
                INSERT INTO task_labels (task_id, label_id)
                VALUES (v_tid, v_lid)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE '=== Seed complete! ===';
    RAISE NOTICE 'Tenant: Acme Corp (slug=acme-seed)';
    RAISE NOTICE 'Users: 20 (alice@acme.com = admin, all others = member)';
    RAISE NOTICE 'Workspace: Acme Workspace with 5 teams';
    RAISE NOTICE 'Boards: 4 (Engineering Sprints, Design System, Marketing Hub, Product Roadmap)';
    RAISE NOTICE 'Tasks: 500 with assignees, labels, milestones, subtasks, comments, watchers, deps, time entries';
    RAISE NOTICE 'Password for all accounts: Password123!';
END $$;

-- Clean up temp tables
DROP TABLE IF EXISTS _su, _sb, _sc, _sg, _sm, _sl, _sf, _st;
