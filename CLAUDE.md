# TaskBolt

Multi-tenant project management SaaS with kanban boards, task tracking, team collaboration, automations, and real-time updates via WebSockets.

## Core Rules

- **Direct Tools First:** Glob/Grep/Read/Edit before agents
- **KISS + YAGNI:** Simple > Complex
- **No Silent Workarounds:** Report failures, ask user
- **Visual Over Verbal:** Tables > paragraphs
- **Full-Stack Features:** Every feature MUST be implemented end-to-end (backend API + frontend UI). Never build frontend calling endpoints that don't exist, or backend endpoints with no frontend consumer. Optimize the implementation before moving on.
- **Use Subagents & Teams:** Use subagents, worker agents, and TeamCreate wherever possible. Parallelize independent work across agents (research, implementation, review). Prefer multi-agent teams over doing everything sequentially in the main context.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust 1.93, Axum 0.8, Tokio, SQLx 0.8 |
| Frontend | Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19 |
| Database | PostgreSQL 16, Redis 7 |
| Storage | MinIO (S3-compatible) |
| Infra | Docker Compose, Nginx reverse proxy |

## Project Structure

```
backend/
  crates/
    api/src/          # Axum routes, middleware, extractors, WebSocket
    db/src/           # SQLx models, queries, migrations
    auth/src/         # JWT auth, password hashing (Argon2)
    services/src/     # Background jobs, notifications
frontend/src/app/
  core/               # Guards, interceptors, services, initializers
  features/           # 16 modules: admin, archive, auth, dashboard, favorites,
                      #   help, my-tasks, onboarding, portfolio, project,
                      #   settings, shared-board, task-detail, tasks, team, workspace
  shared/             # Reusable components, pipes, types, utils
scripts/              # quick-check.sh, pre-deploy-check.sh, deploy-vps.sh,
                      #   setup-hooks.sh, smoke-test-*.sh, init-db.sh, run_seed.sh,
                      #   docker-entrypoint.sh, monitor-memory.sh, check-disk-usage.sh
```

## Organization Rules

- **Backend routes** -> `backend/crates/api/src/routes/`, one file per resource
- **DB models** -> `backend/crates/db/src/models/`, one per entity
- **SQL migrations** -> `backend/crates/db/src/migrations/`
- **Frontend features** -> `frontend/src/app/features/`, one dir per feature
- **Shared components** -> `frontend/src/app/shared/components/`
- **Services** -> `frontend/src/app/core/services/`, one per API domain
- Single responsibility per file, <800 lines max

## Code Quality

After editing ANY file, run the relevant check:

```bash
# Backend
cd backend && cargo check --workspace --all-targets && cargo clippy --workspace --all-targets -- -D warnings && cargo fmt --all -- --check

# Frontend
cd frontend && npx tsc --noEmit && npm run build -- --configuration=production
```

Fix ALL errors before continuing. Use `./scripts/quick-check.sh` for combined checks.

---

## Test Credentials

| Email | Password | Role |
|-------|----------|------|
| admin1@paraslace.in | (user's password) | Admin |

Use `admin1@paraslace.in` for all testing and browser verification.

---

## VPS Deployment

**This IS the VPS.** App path: `/home/ankur/projects/taskflow` | **Domain:** taskflow.paraslace.in

> **IMPORTANT:** `/root/taskbolt` is DEPRECATED. Do NOT use it. All work happens in `/home/ankur/projects/taskflow`.

```bash
# Deploy (from /home/ankur/projects/taskflow):
docker compose build && docker compose up -d
```

## Pre-Deploy Safety Protocol

**MANDATORY before ANY deploy or `docker compose build`:**

1. Backend changes: `./scripts/quick-check.sh --backend`
2. Frontend changes: `./scripts/quick-check.sh --frontend`
3. Full deploy: `./scripts/pre-deploy-check.sh`

**NEVER skip checks.** Fix errors before proceeding.

## Pre-Commit Hooks (Active)

**Setup:** `git config core.hooksPath .githooks` (already configured)

| # | Check | Blocks? |
|---|-------|---------|
| 1 | Hardcoded secrets (passwords, API keys, tokens) | YES |
| 2 | `debugger` statements in TypeScript | YES |
| 3 | TypeScript type-check (`tsc --noEmit`) if frontend changed | YES |
| 4 | Rust `.unwrap()` / `todo!()` / `println!()` | Warns |
| 5 | SQL: TRUNCATE, DELETE without WHERE, DROP without IF EXISTS | YES |
| 6 | Files > 1MB | YES |
| 7 | Auth file modifications | YES |

`console.log` in TypeScript triggers a **warning** (not a block).
Bypass: `git commit --no-verify` (use sparingly).

---

## Design Context

### Users
TaskBolt serves all segments: internal teams, SMB customers, enterprise organizations, and agencies/freelancers. Users are project managers, team leads, developers, and individual contributors who need to track work, collaborate, and stay on top of deadlines. They use TaskBolt throughout their workday — it's an always-open tool, so it must feel effortless and never fatiguing.

### Brand Personality
**Friendly, approachable, modern** — like Asana meets Monday.com. Warm and inviting without being childish. Professional enough for enterprise, but never cold or corporate. The interface should feel like a helpful teammate, not a bureaucratic tool.

### Emotional Goals
The UI should evoke all four pillars simultaneously:
1. **Confidence & control** — "I know exactly where everything stands"
2. **Delight & momentum** — satisfying micro-interactions, visible progress
3. **Calm & focus** — no visual noise, clean hierarchy, breathing room
4. **Energy & speed** — fast, responsive, keyboard-friendly

### Aesthetic Direction
- **References:** Linear (speed, keyboard-first, minimal chrome) + Monday.com (vibrancy, visual status, colorful boards) + **TickTick** (clean, polished UI) + **Trello** (beautiful, approachable boards)
- **Anti-references:** Jira (cluttered, slow, overwhelming), generic Bootstrap dashboards
- **Focus:** Visual polish and aesthetics are the priority. Layout and functionality are settled — invest effort in making existing views look beautiful.
- **Theme:** Light/dark with system detection. 8 interchangeable accent colors (blue, indigo, green, orange, rose, violet, amber, slate). Card style variants (flat/raised/bordered), configurable border radius, sidebar style options.
- **Color palette:** "Midnight Ink" — blue primary (`#2D5BE3` light / `#4B74F0` dark) with warm parchment neutrals (`#F4F2EE` light bg). **Still being explored** — direction is right but not finalized. Red is reserved for errors/destructive actions only.
- **Typography:** Currently Syne (display) + DM Sans (body) — **still being explored**, may change before launch.
- **Motion:** Animations and micro-interactions are welcome and encouraged. User prefers aesthetic richness. Transition tokens defined: `--ease-out-expo`, `--ease-bounce`, `--duration-fast` (150ms), `--duration-normal` (200ms). Still respect `prefers-reduced-motion` for accessibility.

### Design Principles
1. **Clarity over decoration** — Every pixel earns its place. No ornamental elements that don't aid comprehension. White space is a feature.
2. **Progressive density** — Show summary by default, reveal detail on demand. Dashboards are scannable; detail views are comprehensive.
3. **Color with purpose** — Color encodes meaning (priority, status, progress), not just aesthetics. The palette is vibrant but systematic.
4. **Responsive delight** — Micro-interactions (transitions, hover states, completion celebrations) make the tool feel alive. Lean into motion — animations add personality and polish.
5. **Accessible by default** — WCAG AA compliance. Visible focus states, sufficient contrast, keyboard navigable, screen-reader friendly. Never rely on color alone to convey information.
6. **Polish over novelty** — Prioritize making existing views beautiful over adding new features. A well-crafted existing screen beats a rough new one.

### Design Token Architecture
| Layer | Description |
|-------|-------------|
| **Semantic tokens** (`styles.css :root` / `html.dark`) | Light/dark mode colors, shadows, layout, transitions |
| **Structural variants** (`themes.css`) | Card style, border radius, sidebar style — applied via `data-*` attributes |
| **Accent ramps** (`color-palettes.ts`) | Full 50–950 shade scales for 8 accents, synced to PrimeNG via `definePreset()` |
| **Status colors** (`task-colors.ts`) | Priority, status, label, and column colors — Tailwind classes with dark mode |
| **Theme service** (`theme.service.ts`) | Orchestrates mode/accent/preferences, persists to DB, cross-tab sync |

### Key Design Files
| File | Purpose |
|------|---------|
| `frontend/src/styles.css` | Master design tokens (semantic colors, shadows, layout, transitions) |
| `frontend/src/themes.css` | Structural variants (card style, radius, sidebar) via `data-*` attributes |
| `frontend/src/app/core/services/theme.service.ts` | Theme orchestration + PrimeNG bridge + DB persistence |
| `frontend/src/app/core/constants/color-palettes.ts` | 8 accent color ramps (50–950 shades) |
| `frontend/src/app/shared/utils/task-colors.ts` | Priority, status, label, column color mappings |
| `frontend/src/app/shared/types/theme.types.ts` | AccentColor and ColorMode type definitions |

---

*Do the work, show results.*
