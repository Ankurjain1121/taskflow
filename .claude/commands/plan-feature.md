---
name: plan-feature
description: Research and plan the implementation of one or more TASK.md features using parallel plan agents
---

<!-- ============================================================
     EDIT ONLY THIS SECTION — change the task IDs you want planned
     Examples: B1  B3  C1-C9  D1  F1-F3  G1  H2  I4
     ============================================================ -->

## Tasks to Plan

```
TASK_IDS = B1
```

<!-- ============================================================
     DO NOT EDIT BELOW THIS LINE
     ============================================================ -->

---

You are the orchestrator. For every task ID listed above, launch one parallel plan agent using the Agent tool. All agents run simultaneously.

Each agent receives the prompt below, with `{{TASK_ID}}` substituted for the actual task ID.

---

## Agent Prompt Template

```
You are a plan agent for TaskFlow (Angular 19 + Rust/Axum). Your job is to produce a
complete, actionable implementation plan for feature: {{TASK_ID}}

Working directory: /home/ankur/taskflow
Stack: Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19, Rust 1.93, Axum 0.8, SQLx 0.8, PostgreSQL 16

─────────────────────────────────────────
STEP 1 — READ CONTEXT (do this first, in parallel)
─────────────────────────────────────────
Read all three files before doing anything else:

1. /home/ankur/taskflow/TASK.md          — feature registry and phase context
2. /home/ankur/taskflow/comp.md          — competitor analysis for {{TASK_ID}}
3. /home/ankur/taskflow/RESEARCH.md      — existing B1-B8 deep research (if relevant)

For C/D/F/G/H/I features also read the matching ultraplan section:
  C → .ultraplan/sections/section-01-board-settings-overhaul.md
  D → .ultraplan/sections/section-03-command-palette.md
  E → .ultraplan/sections/section-05-list-performance.md
  F → .ultraplan/sections/section-06-presence-collaboration.md
  G → .ultraplan/sections/section-07-push-notifications.md
  H → .ultraplan/sections/section-08-feature-discovery.md
  I → .ultraplan/sections/section-09-visual-polish.md

─────────────────────────────────────────
STEP 2 — RESEARCH (skill invocation)
─────────────────────────────────────────
Invoke the research skill to find the latest, most battle-tested implementation
patterns for {{TASK_ID}} in the TaskFlow stack:

  /research-it

Focus your research query on:
  - The specific sub-features of {{TASK_ID}} (from comp.md)
  - Angular 19 / Tailwind CSS 4 / PrimeNG 19 implementation patterns
  - Any Rust/Axum backend changes required
  - The "winner pattern" identified in comp.md — find the best open-source
    example or library that implements it

─────────────────────────────────────────
STEP 3 — PLAN (skill invocation)
─────────────────────────────────────────
Invoke the planning skill to produce a detailed implementation plan:

  /everything-claude-code:plan

Your plan MUST include:

### Requirements
- Restate what {{TASK_ID}} means (from TASK.md + comp.md winner pattern)
- List all sub-features in scope
- List any sub-features explicitly OUT OF SCOPE (with reason)

### Competitor Benchmark
- Paste the winner pattern from comp.md
- Identify the single most important gap TaskFlow has vs best-in-class

### What Already Exists
- List any files / code that already partially implements this
- Describe what needs to be extended vs built from scratch

### Backend Changes
- SQL migrations needed (table/column additions)
- New API routes or changes to existing routes (file: backend/crates/api/src/routes/)
- New DB models or query changes (file: backend/crates/db/src/)
- If none needed: explicitly state "No backend changes required"

### Frontend Changes
- New components (file paths, Angular selector names)
- Modified components (file path + what changes)
- New services or modifications (file path + what changes)
- Signal architecture: which signals / computed signals are added
- Template sketches for non-trivial UI (ASCII or pseudo-HTML)

### Phased Implementation
Break into 3 phases max:
  Phase 1 — Frontend-only, no backend (fastest to ship)
  Phase 2 — Trivial backend additions (migrations, simple endpoints)
  Phase 3 — Complex features (optional, highest effort)

### File Change List
Complete list of every file to create or modify, with one-line description of the change.

### Success Criteria Checklist
- [ ] Each item is visually verifiable or testable
- [ ] Matches or exceeds the comp.md winner pattern
- [ ] All cargo check / tsc / build checks pass
- [ ] No orphaned code (backend + frontend always paired)

─────────────────────────────────────────
STEP 4 — SAVE THE PLAN
─────────────────────────────────────────
Save the finished plan to:
  /home/ankur/taskflow/plans2/plan-{{TASK_ID_SLUG}}.md

Where {{TASK_ID_SLUG}} is the task ID lowercased with hyphens, e.g.:
  B1      → plans2/plan-b1.md
  C1-C9   → plans2/plan-c1-c9.md
  D1      → plans2/plan-d1.md

Then update TASK.md: in the feature queue row for {{TASK_ID}}, add the new plan
file as an additional link in the Plan column.

─────────────────────────────────────────
CONSTRAINTS
─────────────────────────────────────────
- Use Angular 19 standalone components (no NgModule)
- Use Angular signals (signal/computed/effect) — no RxJS Subjects for state
- Use Tailwind CSS 4 utility classes — no custom CSS unless unavoidable
- Use PrimeNG 19 for complex UI (overlays, date pickers, color pickers)
- Use Angular CDK for overlays/drag-drop — no new DnD libraries
- Rust: no .unwrap() — use proper error handling with ? operator
- SQL: parameterized queries only — no string interpolation
- File size: <800 lines per file — split if larger
- Do NOT implement — only plan
```

---

## Orchestration Instructions (for you, the orchestrator)

1. Parse the `TASK_IDS` line above. Split on whitespace/commas. Each token is one task ID.

2. For each task ID, substitute `{{TASK_ID}}` in the Agent Prompt Template above and launch one Agent tool call. Use `subagent_type: "general-purpose"`.

3. Launch ALL agents in a single message (parallel tool calls). Do not wait for one before launching the next.

4. When all agents complete, summarise:
   - Which plan files were created (`plans2/plan-*.md`)
   - Any agents that failed or raised questions
   - Next step: present the plans to the user for approval before implementation begins
