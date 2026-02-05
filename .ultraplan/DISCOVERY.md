# UltraPlan Discovery: Task Management Tool

> Generated: 2026-02-05
> Phase: 1/6 - UNDERSTAND
> Questions asked: 50 / Target: 40-70
> Categories covered: 8/9 (Category 6 skipped - greenfield)

---

## Codebase Detection

**Codebase found:** No

- **Stack detected:** N/A - Greenfield project
- **Key patterns:** N/A
- **Conventions:** N/A
- **Relevant files:** N/A

---

## Category 1: Core Requirements

**Questions asked:** 8
**Status:** Complete

### Q1: In one sentence, what is the main thing your task management tool should do?
- **Answer:** Help teams organize, assign, and track tasks together

### Q2: If this tool could only do ONE thing on launch day, what would it be?
- **Answer:** Create and assign tasks to team members

### Q3: What are the 3-5 most important features you want?
- **Answer:** Boards, task assignment, due dates, comments (visual boards with columns, assign tasks to people, set deadlines, leave comments)

### Q4: Is there anything similar to what you want that already exists?
- **Answer:** Trello - likes the simplicity but wants more team features

### Q5: What features are nice-to-have but NOT essential for launch?
- **Answer:** Reports, analytics, automations, and recurring tasks

### Q6: Is there anything you definitely do NOT want the tool to do?
- **Answer:** No chat/messaging (use Slack/Teams), no time tracking or invoicing, no document editing (just link to files)

### Q7: What would make someone choose YOUR task tool over alternatives?
- **Answer:** Better team visibility - see who's doing what at a glance

### Q8: How soon do you need a working version?
- **Answer:** A few weeks - basic working version within 2-4 weeks

---

## Category 2: Users & Context

**Questions asked:** 6
**Status:** Complete

### Q9: Who will use this tool?
- **Answer:** Large departments (20-100 people) at established companies

### Q10: How tech-savvy are your users?
- **Answer:** Mixed - some comfortable with tech, some not

### Q11: Will people use this on phone, computer, or both?
- **Answer:** Both - mainly computer but phone for quick checks

### Q12: With 20-100 people, how should permissions work?
- **Answer:** Three roles: Admin, Manager, Member (Admins control settings, Managers create/assign, Members work on assigned tasks)

### Q13: How many users at launch?
- **Answer:** 20-50 users in one or two departments (pilot group, then expand)

### Q14: Will teams need to be organized into groups or departments?
- **Answer:** Yes - separate workspaces or boards per team (people can belong to multiple boards)

---

## Category 3: Integration Points

**Questions asked:** 5
**Status:** Complete

### Q15: Does this need to connect to other apps?
- **Answer:** Slack + WhatsApp (user has own WAHA server running)

### Q16: Should users be able to attach files to tasks?
- **Answer:** Yes - upload files directly to tasks

### Q17: Should the tool send notifications?
- **Answer:** In-app notifications plus email for important things

### Q18: For WhatsApp notifications, how should that work?
- **Answer:** User has their own WAHA (self-hosted WhatsApp HTTP API) server running - integrate with that directly

### Q19: Should users be able to import or export task data?
- **Answer:** No import/export needed

---

## Category 4: Edge Cases

**Questions asked:** 6
**Status:** Complete

### Q20: What should happen when something goes wrong?
- **Answer:** Show friendly error message and let user retry

### Q21: What if two people edit the same task at the same time?
- **Answer:** Last save wins, show who changed what in activity log

### Q22: What happens when a user is removed from the team?
- **Answer:** Reassign their tasks to a manager, keep all history

### Q23: Should there be limits on file size, tasks, boards?
- **Answer:** Yes - reasonable limits (10MB per file, 1000 tasks per board, 50 boards per workspace)

### Q24: What should the empty state look like for new users?
- **Answer:** Quick tutorial with sample tasks they can delete

### Q25: Should users be able to undo or reverse actions?
- **Answer:** Yes - deleted items go to trash bin for 30 days

---

## Category 5: Quality Attributes

**Questions asked:** 6
**Status:** Complete

### Q26: How fast should pages load?
- **Answer:** Fast - under 2 seconds, actions feel instant

### Q27: How important is security?
- **Answer:** Standard business security - encrypted data, secure login (HTTPS, hashed passwords, encrypted at rest)

### Q28: Should the app work around the clock?
- **Answer:** Mostly always available with rare planned maintenance (99.5% uptime target)

### Q29: Do you need activity tracking?
- **Answer:** Both per-task activity log AND full company-wide audit log for admins

### Q30: Should the app support multiple languages?
- **Answer:** English only for now, add more later (build system so languages can be added without rewriting)

### Q31: How important is accessibility?
- **Answer:** Not a priority right now

---

## Category 6: Existing Patterns

**Skipped - Greenfield project (no existing codebase)**

---

## Category 7: Preferences & Tradeoffs

**Questions asked:** 6
**Status:** Complete

### Q32: Simpler with fewer features, or more powerful but complex?
- **Answer:** Start simple, add complexity as users ask for it

### Q33: Clean minimal look or feature-rich interface?
- **Answer:** Clean and minimal - show only what's needed

### Q34: Tech preferences for how it should be built?
- **Answer:** No preference - use whatever works best

### Q35: How do you feel about third-party services?
- **Answer:** Only open-source or self-hosted services (no proprietary cloud services)

### Q36: For file storage, how should it work with the open-source constraint?
- **Answer:** Self-hosted MinIO (S3-compatible, open-source)

### Q37: Who will maintain this going forward?
- **Answer:** Keep using AI tools for updates and improvements

---

## Category 8: Monetization & Business Model

**Questions asked:** 5
**Status:** Complete

### Q38: How do you plan to make money?
- **Answer:** Freemium SaaS - free tier with paid upgrades

### Q39: Will you need billing features?
- **Answer:** Yes - planning to sell to other companies later

### Q40: Legal or compliance requirements?
- **Answer:** Basic data protection - standard security practices

### Q41: What should free vs paid users get?
- **Answer:** 1 board free + 15-day free trial of premium features. All features available during trial. Retrial requests handled case by case.

### Q42: Pricing model?
- **Answer:** Flat team pricing ($29/month for up to 20 users)

---

## Category 9: Visual & UX Vision

**Questions asked:** 8
**Status:** Complete

### Q43: Describe the look and feel you want.
- **Answer:** Modern and minimal - clean whites, subtle colors, lots of whitespace

### Q44: Any apps whose design you love?
- **Answer:** Linear (minimal, fast, keyboard-friendly)

### Q45: What are the 3-4 most important screens?
- **Answer:** Board view, Task detail, Team overview, My Tasks

### Q46: Dark mode, light mode, or user choice?
- **Answer:** Let users choose, default to light mode

### Q47: How should main navigation work?
- **Answer:** Left sidebar with boards and sections, like Linear

### Q48: Brand colors, logo, or fonts?
- **Answer:** No - use clean default theme for now

### Q49: What should users see on first sign-up?
- **Answer:** Quick 3-step setup: name workspace, invite team, see sample board

### Q50: How should the app feel to use?
- **Answer:** Fast and snappy - every click feels instant (optimistic updates, smooth transitions)

---

## Discovery Summary

### Coverage

| # | Category | Questions | Status |
|---|----------|-----------|--------|
| 1 | Core Requirements | 8 | Complete |
| 2 | Users & Context | 6 | Complete |
| 3 | Integration Points | 5 | Complete |
| 4 | Edge Cases | 6 | Complete |
| 5 | Quality Attributes | 6 | Complete |
| 6 | Existing Patterns | 0 | Skipped (Greenfield) |
| 7 | Preferences & Tradeoffs | 6 | Complete |
| 8 | Monetization & Business Model | 5 | Complete |
| 9 | Visual & UX Vision | 8 | Complete |

**Total questions asked:** 50
**Total follow-ups:** 3 (WhatsApp method, free vs paid tiers, file storage)
**Categories fully covered:** 8/9
**Categories skipped:** Category 6 (Greenfield)

### Early Stop

**Triggered:** No

### Key Themes

1. Team collaboration and visibility are the core value proposition - "see who's doing what at a glance"
2. Open-source/self-hosted constraint shapes the entire tech stack (MinIO, WAHA, no proprietary cloud)
3. Linear-inspired UX: minimal, fast, keyboard-friendly, left sidebar navigation
4. Freemium SaaS with flat team pricing ($29/month per 20 users) and 15-day trial
5. Three-role permission system (Admin/Manager/Member) for 20-100 user departments

### Critical Requirements

1. Kanban boards with task creation, assignment, due dates, and comments
2. Three-role permissions (Admin, Manager, Member) with per-team boards
3. Notifications via in-app + email + Slack + WhatsApp (WAHA server)
4. All infrastructure must be open-source or self-hosted
5. Freemium billing with flat team pricing and 15-day trial

### Open Questions

1. What specific open-source tech stack should be used? (Research Phase will determine)
2. How should the WAHA WhatsApp integration be structured? (needs API research)
3. What open-source billing solution works for flat team pricing? (Research Phase)
4. How to handle retrial requests after 15-day premium trial expires?
