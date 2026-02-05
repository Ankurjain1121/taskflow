# UltraPlan Research: Task Management Tool

> Generated: 2026-02-05
> Phase: 2/6 - RESEARCH
> Subagents: 3 (codebase/tech stack, web research, library docs)
> Topics researched: 8

---

## Tech Stack Recommendation

### Recommended: TypeScript Monorepo Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 16 + React | Fastest framework, best AI tool support, SSR built-in |
| **Styling** | Tailwind CSS v4 + shadcn/ui | CSS-first config, fastest build times, great component library |
| **Backend** | Next.js API Routes + tRPC | End-to-end type safety, zero REST boilerplate, single deployment |
| **Database** | PostgreSQL 16 + Drizzle ORM | Best open-source DB + fastest TypeScript ORM (7kb, zero binaries) |
| **Auth** | Better Auth | MIT license, lightweight, first-class Next.js integration, built-in RBAC |
| **Real-time** | Soketi (Pusher-compatible WebSockets) | Self-hosted, lightweight, handles board live updates |
| **Drag-and-Drop** | dnd-kit | Best React Kanban support, modular, accessible |
| **Billing** | Lago (self-hosted) | Free, supports flat subscription pricing, web UI for management |
| **File Storage** | MinIO | S3-compatible, self-hosted, presigned URL uploads |
| **Email** | Postal (self-hosted SMTP) | MIT license, high-volume capable, delivery tracking |
| **Notifications** | Novu (self-hosted) | Unified API: in-app + email + Slack + WhatsApp routing |
| **WhatsApp** | WAHA (user's existing server) | REST API, free core, already running |
| **Security** | PostgreSQL RLS + tenant_id | Database-level tenant isolation for multi-tenant SaaS |

**Why this stack over alternatives:**
- Single language (TypeScript) = lowest maintenance cost for AI-maintained codebase
- AI tools (Claude, Cursor, Copilot) have deepest training data on Next.js + TypeScript
- Simplest deployment: one Next.js app + PostgreSQL + supporting services via Docker Compose
- All components are open-source and self-hostable (matches user constraint)

### Alternatives Considered

| Criteria | Option 1: TS Monorepo (CHOSEN) | Option 2: Decoupled Enterprise | Option 3: Python Power |
|---|---|---|---|
| Languages | TypeScript only | TypeScript only | TypeScript + Python |
| AI-friendliness | 9/10 | 7/10 | 7/10 |
| Self-hosting ease | 8/10 | 5/10 | 6/10 |
| MVP Speed | Fastest | Slowest | Medium |
| Team size sweet spot | 1-5 devs | 5-15 devs | 3-8 devs |
| Infrastructure cost | Lowest | Highest | Medium |

---

## Competitor Analysis

### Summary Matrix

| Feature | Trello | Linear | Plane.so | Focalboard | Taiga |
|---|---|---|---|---|---|
| Open Source | No | No | Yes (AGPL) | Yes (MIT) | Yes (MPL) |
| Self-Hostable | No | No | Yes | Yes | Yes |
| Kanban | Excellent | Secondary | Good | Good | Good |
| Team Visibility | Poor | Good | Good | Poor | Good |
| Performance | Good | Excellent | Good | Good | Fair |
| UI Modernity | Good | Excellent | Good | Fair | Poor |
| Free Tier | Limited | Personal only | Unlimited | Unlimited | Limited |

### Key Lessons

**From Trello:** Copy the instant-onboarding experience (first task in under 60 seconds). Keep drag-and-drop buttery smooth. BUT add team visibility and reporting that Trello lacks.

**From Linear:** Invest in perceived performance (optimistic UI, local-first data). Build a Cmd+K command palette. Use subtle animations (150-200ms). Keep UI minimal with lots of whitespace. BUT don't sacrifice Kanban usability or ignore non-technical users.

**From Plane.so:** Match their feature set as minimum bar (issues, cycles, modules, views). Offer Docker Compose one-command setup. BUT use single language (not Django + Next.js split).

**From Focalboard:** Support multiple views (Kanban, table, calendar) from the start. BUT build as standalone product, not tied to a chat platform.

**From Taiga:** Study their agile features as reference. Support data import from Trello/Jira. BUT don't let the UI stagnate.

### Competitive Differentiators for Our Product

1. **Team visibility as first-class feature** - "Who is overloaded?" dashboard that no competitor does well
2. **Linear-grade performance on self-hosted stack** - optimistic UI, local-first sync
3. **Multi-channel notifications** - In-app + Email + Slack + WhatsApp (unique: no open-source competitor offers WhatsApp)
4. **Aggressive pricing** - $29/month per 20 users = $1.45/user vs Trello $5-17.50/user or Linear $8/user
5. **One-command self-hosting** - `docker compose up` with sane defaults

---

## Best Practices Research

### Kanban Board Architecture
- Use **dnd-kit** for drag-and-drop (modular, hook-based, accessible)
- Implement WIP (Work-in-Progress) limits per column from the start
- Ready-made reference: dnd-kit + Tailwind + shadcn/ui Kanban board on GitHub
- Expect 2-4 weeks development for production-ready Kanban with DnD + real-time

### Real-Time Collaboration
- **WebSockets** for bidirectional board collaboration (card moves, edits, presence)
- **Soketi** is self-hosted, Pusher-compatible, lightweight
- Use **Redis pub/sub** for scaling WebSocket connections across multiple server instances
- Implement **optimistic UI updates** - update the board immediately, sync with server in background

### Open-Source Billing (Lago)
- Self-hosted version is completely free
- Supports flat subscription pricing ($29/month per 20 users)
- Ships with web UI for managing customers, plans, and invoices
- Deploy via `docker compose up`
- Connects to any payment gateway

### WAHA WhatsApp Integration
- REST API: `POST /api/sendText` with `chatId` formatted as `{phone}@c.us`
- Supports text, images, videos, voice messages
- Webhooks for incoming messages and delivery status
- Three engines: WEBJS (most stable), NOWEB (lighter), GOWS (best performance)
- QR code scanning required for initial authentication

### MinIO File Storage
- Use **presigned PUT URLs** for client-side uploads (never expose credentials)
- Small files (<5MB): single presigned PUT
- Large files (>5MB): multipart upload with presigned URLs per part
- Bucket structure: `task-attachments/{workspaceId}/{taskId}/{filename}`
- Store file metadata in PostgreSQL alongside task records
- Set explicit short expiry times on presigned URLs

### Multi-Tenant Security
- **PostgreSQL Row-Level Security (RLS)** as baseline protection
- Add `tenant_id` column to ALL tenant-scoped tables
- Create RLS policies using runtime variables
- Index `tenant_id` columns for performance
- Multi-tenancy MUST be a foundational decision, not bolted on later
- Defense-in-depth: RLS + application middleware + API gateway tenant validation

### Transactional Email
- **Postal** for self-hosted SMTP (MIT license, delivery tracking, webhooks)
- **Novu** as notification orchestration layer routing to email + in-app + Slack + WhatsApp
- Configure SPF, DKIM, DMARC, rDNS for deliverability
- Consider hybrid approach: self-hosted Postal for sending + reputable SMTP relay as fallback

---

## Library Documentation

### Next.js 16
- Turbopack is the default bundler (3.5x faster builds)
- `cookies()`, `headers()`, `params`, `searchParams` MUST be awaited (breaking change from v15)
- `fetch` requests and GET Route Handlers are NOT cached by default
- Server Actions enable direct database mutations from forms
- Middleware handles auth redirects at the edge

### Drizzle ORM
- SQL-first, zero-overhead, ~7kb runtime
- Type-safe queries with full TypeScript inference
- Zero binary dependencies (unlike Prisma's Rust engine)
- Supports PostgreSQL RLS policies natively

### MinIO JavaScript SDK (v8.0.6)
- Built-in TypeScript types (no @types needed)
- `presignedPutObject()` for upload URLs
- `presignedGetObject()` for download URLs
- `newPostPolicy()` for browser upload with size/type restrictions
- `listenBucketNotification()` for real-time file event monitoring (MinIO-specific)

### Tailwind CSS v4
- CSS-first configuration via `@theme` blocks (no tailwind.config.js)
- Automatic content detection (no `content` array needed)
- Full rebuilds 3.5x faster, incremental 8x faster
- Dark mode via `dark:` variant with `data-theme` attribute support

---

## Conflicts Detected

| # | Your Preference | Research Finding | Recommendation |
|---|----------------|-----------------|----------------|
| 1 | No import/export needed | Competitor analysis shows import from Trello/Jira drives adoption | Keep as out-of-scope for launch, add later |
| 2 | Not a priority: accessibility | Standard business tools need WCAG basics for legal compliance | Add minimal keyboard nav + ARIA labels (low effort) |
| 3 | No preference on tech stack | Research strongly recommends TypeScript Monorepo | Adopt the recommended stack |

---

## Open Questions Resolved

| Question | Answer |
|----------|--------|
| What open-source tech stack? | Next.js 16 + tRPC + Drizzle + PostgreSQL + Better Auth |
| How to structure WAHA integration? | REST API with webhook callbacks, via Novu notification orchestrator |
| What open-source billing for flat pricing? | Lago (self-hosted, free, supports flat subscriptions) |
| How to handle retrial requests? | Lago supports plan modifications via API; build an admin panel action |
