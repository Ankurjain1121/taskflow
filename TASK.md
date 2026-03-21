# TASK: Workspace Navigation Overhaul

## Objective
Make workspace switcher prominent in topbar, remove sidebar duplication, add hierarchical "All Projects" tree in sidebar. Role-aware dropdown with project/member count badges.

## Reviews Passed
- CEO Review: CLEAR (Selective Expansion, 4 cherry-picks accepted)
- Design Review: CLEAR (9/10)
- Eng Review: CLEAR (0 critical gaps)
- Full plan: `~/.gstack/projects/Ankurjain1121-taskflow/ceo-plans/2026-03-20-workspace-nav-overhaul.md`

## Key Decisions
- Data loading: Backend returns workspace counts (badges); frontend parallel listBoards() per ws (tree)
- Signal dependency: loadAllProjects() waits for workspaces() via effect()
- localStorage: `taskflow_all_projects_collapsed` = Record<wsId, boolean>
- Role thresholds: "Manage" link for owner/admin only
- Collapsed sidebar: All Projects section HIDDEN
- Animations: 150ms slide + chevron rotate, respects prefers-reduced-motion
- Ship directly, no feature flag

## Steps

### Step 1: Backend — Add counts to workspace list
- [ ] Modify workspace list query to include project_count + member_count via COUNT subqueries
- [ ] Update response struct (WorkspaceWithCounts or extend existing)
- [ ] cargo check + clippy

### Step 2: Frontend — Enhance WorkspaceSwitcherComponent
- [ ] Topbar mode: bigger name (text-base font-bold), avatar 28px
- [ ] Dropdown: show "4 projects · 12 members" badge per workspace
- [ ] "Manage →" link for owner/admin workspaces
- [ ] Update WorkspaceService interface to include counts

### Step 3: Frontend — Remove sidebar workspace switcher
- [ ] Remove WorkspaceSwitcherComponent from sidebar.component.ts imports/template
- [ ] Sidebar now: Home → Projects → All Projects → Views → Footer

### Step 4: Frontend — Create SidebarAllProjectsComponent
- [ ] New ~200-line component in sidebar/
- [ ] effect() watches workspaces(), calls listBoards() per ws in parallel (forkJoin + catchError)
- [ ] Collapsible sections: workspace header (name + count + chevron)
- [ ] Project items: reuse .project-item pattern, auto-switch workspace on click
- [ ] localStorage collapse state (Record<wsId, boolean>)
- [ ] Loading: skeleton per section. Empty: "No projects in {name}"
- [ ] Hidden when sidebar collapsed

### Step 5: Frontend — Wire into sidebar
- [ ] Add SidebarAllProjectsComponent between projects and views
- [ ] "ALL PROJECTS" section label

### Step 6: Build + Deploy
- [ ] tsc --noEmit + production build
- [ ] Docker build + deploy
- [ ] Verify all 10 verification items from plan

## Design Specs
- Topbar: Avatar 28px → name (text-base font-bold) → chevron (10px muted)
- Dropdown: Avatar + name → badge → Manage → checkmark
- Tree label: .section-label (10px, 600 weight, uppercase)
- Tree header: text-sm font-semibold, --sidebar-text-secondary
- Tree items: exact .project-item class from sidebar-projects
- Collapse animation: max-height 150ms ease-out
- Responsive: Desktop full, Tablet hide-when-collapsed, Mobile avatar+chevron only
- A11y: role="tree"/"treeitem", aria-expanded, 44px touch targets

## Progress Log
- 2026-03-20: CEO review CLEARED, Design review 9/10, Eng review CLEARED.
- 2026-03-20: Implemented via 3 parallel agents. All steps complete. Deployed.
