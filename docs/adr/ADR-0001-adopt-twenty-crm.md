# ADR-0001: Adopt Twenty CRM (AGPL-3.0) Bundled with TaskBolt

**Status:** Accepted (2026-05-03)

## Context

TaskBolt originally planned a native Rust+Angular CRM module (contacts, companies, deals, pipeline board, automations, 360-degree views) per the deferred plan in `~/.claude/projects/-home-ankur-projects-taskflow/memory/project_crm_module.md`. A first-principles review (`/home/ankur/.claude/plans/donwload-twenty-one-open-purring-parasol.md`, lines 25-69, 334-419) re-scoped this work: building competitive Pipeline + Custom-Objects + Workflow Builder natively would consume months, while [Twenty](https://github.com/twentyhq/twenty) (AGPL-3.0, 45k stars, active development) provides multi-engineer-years of CRM logic out of the box plus REST/GraphQL/webhooks/Apps.

CEO review evaluated three approaches (plan lines 396-419): **A** = Twenty unmodified + thin Rust adapter, **B** = fork Twenty, **C** = native rebuild. Approach A was selected unanimously by both CEO voices.

## Decision

Adopt Twenty CRM, bundled and self-hosted alongside TaskBolt on VPS2, as the official CRM surface. Per CEO Approach A:

1. **Strict no-fork policy.** Twenty source remains unmodified (`git -C twenty diff --stat` must remain empty per Phase 0 verification, plan line 272).
2. **All extension via supported boundaries only:** Twenty custom objects, workflows, REST/GraphQL API, webhooks, and Apps system (TypeScript packages distributed separately as AGPL-compatible boundary). No patches to Twenty's NestJS+React source.
3. **TaskBolt-side bridging only:** SSO bridge, sync workers, link tables, and UI shell live in the TaskBolt repo (Rust+Angular).
4. The native CRM module is officially deprecated.

## Consequences

**Positive:**
- AGPL-safe (we run unmodified upstream); no source-disclosure obligation for TaskBolt code.
- Inherits Twenty's roadmap and bug fixes for free; auto-updates are feasible (see ADR-0004).
- Smallest possible TaskBolt code surface for CRM functionality.
- Ships in 4-5 weeks vs. 3-6 months for native rebuild.

**Negative:**
- Foreign stack (NestJS+React+Yarn4+Node24) raises ops surface alongside Rust+Angular.
- Twenty's roadmap drift becomes our drift; data model changes inherited.
- AGPL-in-package is a real friction signal at enterprise sales motion (user accepted risk; legal audit skipped per USER DECISIONS UC2).
- Two databases to operate (separate Postgres for Twenty per Phase 0 decision).

## Alternatives Considered

- **Approach B — Fork Twenty:** Rejected. AGPL forces source publication of every change; competitive moat dissolves; auto-updates impossible; permanent merge-conflict burden.
- **Approach C — Native rebuild:** Rejected. 3-6 month timeline; reinvents Pipeline/Custom-Objects/Workflow Builder that Twenty already ships.
- **Twenty Cloud (managed SaaS):** Rejected for sell-as-package economics; data residency and pricing control require self-host.
