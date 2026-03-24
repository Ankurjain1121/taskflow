# Org Command Center — Design Spec

**Route:** `/discover` (replaces current "join workspace" page)
**Audience:** Owner/CEO — bird's eye org health check
**Usage pattern:** Quick 30-second weekly check-in
**Density:** Executive summary (scannable, one-screen)

## Problem

The `/discover` page currently shows "discoverable open workspaces to join" — a one-time action that's useless after onboarding. Meanwhile, the CEO has no single page to answer: "Is my organization healthy?" The existing `/dashboard` is personal (my tasks, my workspace). There's no cross-workspace, org-level view.

## Authorization

- **Route access**: All authenticated users can visit `/discover` (authGuard only)
- **Data visibility**: Each API call respects existing workspace membership checks — users only see workspaces they belong to
- **Team workload**: The `GET /api/workspaces/{id}/team-workload` endpoint requires `ManagerOrAdmin`. For regular members, the People section in Act 3 is **hidden** (graceful 403 handling). They still see Acts 1, 2, and 4.
- **Health score**: Computed only from data the user can access. If workload data is 403'd, the workload balance factor defaults to 1.0 (neutral).

## Solution

Repurpose `/discover` as an Org Command Center with a 4-act layout:
1. **Hero** — composite health score + key stat cards
2. **Project Health Grid** — all projects across all workspaces with health indicators
3. **People + Velocity** — team workload heatmap + org shipping velocity
4. **Activity Feed** — cross-workspace recent activity (who did what)

## Data Sources (ALL EXISTING — no new backend work)

| Data | API Endpoint | Scope |
|------|-------------|-------|
| Project health | `GET /api/workspaces/{id}/portfolio` | Per workspace, aggregate client-side |
| On-time rate | `GET /api/workspaces/{id}/metrics/workspace` | Per workspace |
| Team workload | `GET /api/workspaces/{id}/team-workload` | Per workspace |
| Velocity | `GET /api/workspaces/{id}/metrics/workspace` | Per workspace |
| Activity feed | `GET /api/dashboard/recent-activity` | Tenant-wide |
| Member count | `GET /api/workspaces` (project_count + member_count fields) | All workspaces |

## Architecture

```
/discover route
  └─ OrgCommandCenterComponent (container, ~300 lines)
       ├─ Act 1: OrgHealthHeroComponent
       │    ├─ Health score (computed client-side from portfolio + metrics)
       │    └─ 4 stat cards (projects, on-time, alerts, people)
       ├─ Act 2: OrgProjectGridComponent
       │    └─ @for workspace → @for project → ProjectHealthCard
       ├─ Act 3: OrgPeopleVelocityComponent
       │    ├─ Left: team workload bars (per workspace, aggregated)
       │    └─ Right: velocity sparkline (12-week trend)
       └─ Act 4: OrgActivityFeedComponent
            └─ Recent activity entries (cross-workspace)
```

## Health Score Formula

**Score: 0-100**, computed client-side from 4 factors:

```
healthScore =
    (onTimeRate * 0.40)              // 40% weight: on-time delivery
  + ((1 - overdueRatio) * 0.30)     // 30% weight: fewer overdue = higher
  + (workloadBalance * 0.20)        // 20% weight: nobody overloaded
  + (velocityTrend * 0.10)          // 10% weight: shipping faster = bonus

Where:
  onTimeRate = metrics.on_time_pct / 100              (0.0 to 1.0)
  overdueRatio = totalTasks === 0 ? 0 : totalOverdue / totalTasks  (0.0 to 1.0)
  workloadBalance = totalMembers === 0 ? 1.0 : 1 - (overloadedMembers / totalMembers)
  velocityTrend = velocity data unavailable ? 0.5 : clamp(thisWeek / lastWeek, 0.5, 1.5) normalized to 0-1

  Overloaded threshold: hardcoded to 10 active tasks (same as team-workload endpoint)

  Velocity source: WorkspaceDashboard.velocity (Vec<VelocityPoint> with week_start + tasks_completed)
  Use last 2 entries for trend: thisWeek = velocity[-1].tasks_completed, lastWeek = velocity[-2].tasks_completed
```

**Display:**
- 80-100: Green badge "Healthy"
- 60-79: Amber badge "Needs Attention"
- 0-59: Red badge "At Risk"

## Act 1: Hero Section

```
┌──────────────────────────────────────────────────────────────┐
│  ┌─────────────────┐   ┌────────┐ ┌────────┐ ┌────────┐    │
│  │    87            │   │   12   │ │  94%   │ │   3    │    │
│  │  ━━━━━━━━━━━━━  │   │Projects│ │On-Time │ │Overdue │    │
│  │  Healthy ✓      │   │        │ │        │ │        │    │
│  └─────────────────┘   └────────┘ └────────┘ └────────┘    │
│  "Your organization is on track. 3 tasks need attention."    │
└──────────────────────────────────────────────────────────────┘
```

- Health score: large number (text-5xl font-bold), circular progress ring
- Status badge: colored pill (Healthy/Needs Attention/At Risk)
- Contextual sentence: auto-generated from data ("3 tasks overdue across 2 projects")
- 3 stat cards: Total Projects, On-Time Rate, Overdue Count

## Act 2: Project Health Grid

```
┌──────────────────────────────────────────────────────────────┐
│  Main Workspace                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Eng Tasks │ │Marketing │ │Design    │ │Roadmap   │       │
│  │████████░░│ │████░░░░░░│ │██████░░░░│ │███░░░░░░░│       │
│  │72% ✓     │ │45% ⚠     │ │63% ✓     │ │30% 🔴    │       │
│  │24 tasks  │ │18 tasks  │ │12 tasks  │ │35 tasks  │       │
│  │2 overdue │ │5 overdue │ │0 overdue │ │12 overdue│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  QA Workspace                                                │
│  ┌──────────┐                                                │
│  │QA Tests  │                                                │
│  │██████████│                                                │
│  │100% ✓    │                                                │
│  └──────────┘                                                │
└──────────────────────────────────────────────────────────────┘
```

- Grouped by workspace (workspace name as section header)
- Each card: project name, progress bar, health indicator, task count, overdue count
- Health from existing `portfolio.health` field (on_track/at_risk/behind)
- Click card → navigate to project board

## Act 3: People + Velocity (Side by Side)

```
┌───────────────────────────┐  ┌───────────────────────────┐
│ Team Workload              │  │ Org Velocity               │
│                            │  │                            │
│ Kate J.  ██████░░  8 tasks │  │ ▁▂▃▅▆▇█▇▆▅▇█  47/week   │
│ Alex M.  ████░░░░  4 tasks │  │                            │
│ Sam P.   █████████ 12! ⚠   │  │ ↑ 12% vs last month      │
│ Dev R.   ███░░░░░  3 tasks │  │                            │
│ Maya K.  ██████░░  7 tasks │  │ On-time: 94%              │
│                            │  │ Avg cycle: 3.2 days       │
│ 1 member overloaded        │  │                            │
└───────────────────────────┘  └───────────────────────────┘
```

- **Left**: Top members by task count, horizontal bars, overloaded (>10) highlighted red
- **Right**: 12-week velocity sparkline, trend arrow, on-time rate, avg cycle time
- Data aggregated across ALL workspaces

## Act 4: Activity Feed

```
┌──────────────────────────────────────────────────────────────┐
│ Recent Activity                                              │
│                                                              │
│ KJ  Kate completed "Fix auth bug" in Eng Tasks       2h ago │
│ AM  Alex moved "Update docs" to In Progress           3h ago │
│ SP  Sam created "New API endpoint" in Roadmap         5h ago │
│ DR  Dev commented on "Login redesign" in Design      1d ago │
│                                                              │
│ Show more...                                                 │
└──────────────────────────────────────────────────────────────┘
```

- Uses existing `GET /api/dashboard/recent-activity?limit=10`
- Actor avatar initials, action description, project name, relative time
- "Show more" loads next page (cursor-based pagination already exists)

## Loading Strategy

1. Page init: fetch workspace list (already cached in WorkspaceContextService)
2. For each workspace in parallel (forkJoin):
   - `GET /portfolio` (project health)
   - `GET /metrics/workspace` (velocity, on-time)
   - `GET /team-workload` (people)
3. Separately: `GET /recent-activity` (activity feed)
4. Compute health score client-side from aggregated data

Show skeleton loaders per act while loading. Each act renders independently as its data arrives.

## Component Files

| File | Lines | What |
|------|-------|------|
| `features/discover/org-command-center.component.ts` | ~150 | Container, data loading, health computation |
| `features/discover/org-health-hero.component.ts` | ~100 | Health score ring + stat cards |
| `features/discover/org-project-grid.component.ts` | ~120 | Project cards grouped by workspace |
| `features/discover/org-people-velocity.component.ts` | ~120 | Workload bars + velocity sparkline |
| `features/discover/org-activity-feed.component.ts` | ~80 | Activity list with pagination |

Total: ~570 lines across 5 files.

## Route Change

```typescript
// app.routes.ts — replace current discover route
{
  path: 'discover',
  loadComponent: () =>
    import('./features/discover/org-command-center.component').then(
      (m) => m.OrgCommandCenterComponent,
    ),
  canActivate: [authGuard],
}
```

The old `DiscoverWorkspacesComponent` is deleted. The "join workspace" functionality moves to the workspace switcher dropdown (which already has "+ New Workspace").

## Responsive Behavior

- **Desktop (>=1024px)**: Full 4-act layout, Acts 3 side-by-side
- **Tablet (768-1023px)**: Acts 3 stacked (workload above velocity)
- **Mobile (<768px)**: Single column, project cards 2-per-row, activity feed condensed

## Empty States

- 0 workspaces: "Create your first workspace to see your organization's health." (entire page is this CTA)
- 0 projects: Health score = 100 (healthy by default), Acts 2-3 show "Create projects to track progress." Act 4 may still show activity.
- 0 team members: Workload section hidden
- API errors: Per-act error with retry button, other acts still render

## Success Criteria

1. CEO opens /discover → sees health score within 3 seconds
2. Can identify which projects are "behind" without clicking anything
3. Can spot overloaded team members at a glance
4. Activity feed shows cross-workspace recent actions
5. Page loads in <2s (parallel API calls + skeleton loaders)
