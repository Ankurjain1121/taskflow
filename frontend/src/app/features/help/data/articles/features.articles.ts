import { HelpArticle } from '../../models/help-article.model';

export const FEATURES_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'kanban-boards',
    categorySlug: 'features',
    title: 'Kanban Boards',
    summary: 'Drag-and-drop task management with customizable columns and status mappings.',
    videoUrl: '/videos/02-kanban-board.mp4',
    content: `
## Overview

Kanban boards are the primary way to manage tasks in TaskBolt. Each project has a board with customizable columns that represent your workflow stages.

## Customizing Columns

1. Open your project
2. Click **Project Settings** (gear icon)
3. Under **Columns**, you can:
   - Add new columns
   - Rename existing columns
   - Reorder columns by dragging
   - Set column WIP (Work In Progress) limits
   - Map columns to task statuses

## Working with Cards

- **Drag and drop** cards between columns to move them through your workflow
- Cards show the task title, assignee avatar, priority badge, and due date
- Click a card to open the full task detail view

## Color Modes

TaskBolt supports color-coding cards by:

- **Priority** — color indicates urgency (green = low, red = urgent)
- **Label** — cards show their label colors
- **Assignee** — each team member gets a unique color
- **Project** — useful in cross-project views

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **N** | New task |
| **/** | Focus search |
| **?** | Show all shortcuts |
| **Ctrl+Shift+↑** | Create task above focused row |
| **Ctrl+Shift+↓** | Create task below focused row |

## Tips

- Collapse columns you don't need to focus on active work
- Use **filters** to show only tasks matching specific criteria
- Enable **swimlanes** to group cards by assignee, priority, or label
    `,
    tags: ['kanban', 'board', 'columns', 'drag-drop', 'cards', 'workflow'],
    order: 1,
    updatedAt: '2026-04-11',
    relatedSlugs: ['create-tasks', 'workflow-automation'],
  },
  {
    slug: 'reports-analytics',
    categorySlug: 'features',
    title: 'Reports & Analytics',
    summary: 'Track progress with burndown charts, velocity reports, and workload analysis.',
    content: `
## Accessing Reports

Navigate to **Reports** from the sidebar to see your project analytics.

## Available Reports

### Burndown Chart
Shows remaining work over time. Useful for tracking whether you're on pace to complete all tasks by a deadline.

### Velocity Report
Tracks how many tasks your team completes per week. Helps with sprint planning and workload estimation.

### Workload Distribution
See how tasks are distributed across team members. Identify overloaded or underutilized members.

### Status Breakdown
Pie chart showing the distribution of tasks across statuses (To Do, In Progress, Done, etc.).

## Filtering Reports

All reports support filtering by:
- Date range
- Project
- Assignee
- Priority
- Labels

## Tips

- Check reports weekly to spot bottlenecks early
- Use the workload report before assigning new tasks
- Export report data as CSV for presentations
    `,
    tags: ['reports', 'analytics', 'burndown', 'velocity', 'charts'],
    order: 2,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'calendar-view',
    categorySlug: 'features',
    title: 'Calendar View',
    summary: 'See tasks on a timeline with due dates and milestones.',
    content: `
## Overview

The calendar view displays tasks based on their due dates, giving you a timeline perspective of your work.

## Using the Calendar

1. Open a project
2. Switch to **Calendar** view from the view selector
3. Tasks with due dates appear on their respective dates
4. Click any date to create a new task for that day
5. Drag tasks between dates to reschedule

## Views

- **Month view** — overview of the entire month
- **Week view** — detailed day-by-day breakdown

## Tips

- Tasks without due dates won't appear in calendar view
- Color-coded by priority or label (matches your board color mode)
- Use calendar view alongside board view for different perspectives
    `,
    tags: ['calendar', 'due date', 'timeline', 'schedule'],
    order: 3,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'recurring-tasks',
    categorySlug: 'features',
    title: 'Recurring Tasks',
    summary: 'Automate repetitive work with daily, weekly, or custom recurrence patterns.',
    content: `
## Setting Up Recurrence

1. Open a task
2. Click the **recurrence** icon (or find it in task properties)
3. Choose a pattern:
   - **Daily** — every day or every N days
   - **Weekly** — specific days of the week
   - **Monthly** — specific day of the month
   - **Custom** — advanced cron-like patterns

## How It Works

When a recurring task is completed:
1. The current task is marked as done
2. A new copy is automatically created with the next due date
3. The new task inherits all properties (assignee, priority, labels, etc.)

## Managing Recurring Tasks

- Edit the recurrence pattern from any instance
- Delete the recurrence to stop future copies
- View all recurring task definitions in **Project Settings > Automations**

## Tips

- Great for standup meetings, weekly reviews, recurring chores
- Combine with automations for fully automated workflows
- Recurring tasks show a small repeat icon on the card
    `,
    tags: ['recurring', 'repeat', 'schedule', 'automation'],
    order: 4,
    updatedAt: '2026-04-08',
    relatedSlugs: ['workflow-automation'],
  },
  {
    slug: 'time-tracking',
    categorySlug: 'features',
    title: 'Time Tracking',
    summary: 'Log time on tasks with start/stop timers or manual entries.',
    content: `
## Tracking Time

### Timer Method
1. Open a task
2. Click the **timer** button to start tracking
3. Work on the task
4. Click **Stop** when done — time is automatically logged

### Manual Entry
1. Open a task
2. Go to the **Time** tab
3. Click **Add Entry**
4. Enter the duration and optional note
5. Click **Save**

## Viewing Time Logs

- Each task shows total time logged
- Go to **Reports** for time tracking analytics across projects
- Filter by date range, assignee, or project

## Tips

- Only one timer can run at a time across all tasks
- Timer persists even if you navigate away
- Use time logs to improve estimation accuracy
    `,
    tags: ['time', 'tracking', 'timer', 'log', 'hours'],
    order: 5,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'dependencies',
    categorySlug: 'features',
    title: 'Dependencies',
    summary: 'Link tasks with blocking/blocked-by relationships.',
    content: `
## Adding Dependencies

1. Open a task
2. Go to the **Dependencies** section
3. Click **Add dependency**
4. Search for the blocking task
5. Choose the relationship type:
   - **Blocked by** — this task can't start until the other is done
   - **Blocks** — this task must be done before the other can start

## Visual Indicators

- Tasks with unresolved blockers show a warning badge on the card
- Dependency chains are visible in the task detail view

## Tips

- Avoid circular dependencies — TaskBolt will warn you
- Use dependencies to enforce workflow order
- Check blocked tasks regularly to unblock your team
    `,
    tags: ['dependencies', 'blocking', 'blocked', 'relationships'],
    order: 6,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'workflow-automation',
    categorySlug: 'features',
    title: 'Workflow Automation',
    summary: 'Set up rules to auto-assign, move, or notify based on triggers.',
    content: `
## What are Automations?

Automations are "when X happens, do Y" rules that run automatically. They eliminate repetitive manual work.

## Creating an Automation

1. Open a project
2. Go to **Automations** (lightning bolt icon in project header)
3. Click **Create Automation**
4. Configure:
   - **Trigger** — what event starts the automation (task created, status changed, due date passed, etc.)
   - **Conditions** — optional filters (e.g., only for high priority tasks)
   - **Actions** — what to do (assign to user, move to column, add label, send notification, etc.)
5. Click **Save**

## Example Automations

| Trigger | Action |
|---------|--------|
| Task moved to "In Review" | Assign to lead reviewer |
| Task marked as Urgent | Send notification to team |
| Due date passed | Move to "Overdue" column |
| Task created | Auto-assign based on label |

## Tips

- Start with simple automations and add complexity as needed
- Test automations on a few tasks before applying broadly
- Check the automation log to see what ran and when
    `,
    tags: ['automation', 'rules', 'triggers', 'actions', 'workflow'],
    order: 7,
    updatedAt: '2026-04-08',
    relatedSlugs: ['recurring-tasks'],
  },
  {
    slug: 'client-portal',
    categorySlug: 'features',
    title: 'Client Portal',
    summary: 'Share projects with external clients via secure read-only links.',
    content: `
## Overview

The Client Portal lets you share project progress with external stakeholders without giving them full access to your workspace.

## Setting Up a Shared Link

1. Open your project
2. Go to **Project Settings**
3. Under **Sharing**, click **Generate Link**
4. Configure what's visible:
   - Task titles and statuses
   - Due dates
   - Progress percentages
5. Copy and share the link

## What Clients See

- A read-only board view of the project
- Task statuses and progress
- No access to comments, internal notes, or team member details

## Managing Shared Links

- Revoke links at any time from Project Settings
- Generate new links to invalidate old ones
- Track when links were last accessed

## Tips

- Use for client updates without scheduling meetings
- Share with stakeholders who need visibility but not editing access
- Combine with status automations to keep the view always current
    `,
    tags: ['client', 'portal', 'sharing', 'external', 'read-only'],
    order: 8,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'project-groups',
    categorySlug: 'features',
    title: 'Project Groups',
    summary:
      'Organize projects into named collections like "Q3 Launches" or "Client X" without creating separate workspaces.',
    content: `
## Overview

Project Groups let you organize the projects inside a workspace into named
collections. A group is lighter than a workspace: everyone in the workspace
still sees all projects, but groups give you a way to slice them into
meaningful buckets like **Q3 Launches**, **Client X**, or **Internal Tools**.

A project can belong to at most one group, or stay ungrouped.

## Creating a group

1. Open **Manage** from the sidebar
2. Go to the **Config** tab
3. Scroll to **Project Groups**
4. Enter a name, pick a color swatch, and click **+ Add Group**

You'll see the new group appear in the list with a project count of 0.

## Assigning projects to a group

1. Open the project's settings
2. Under **Project Group**, pick the group from the dropdown
3. Save

The project now shows up under that group wherever groups are filtered.

## Renaming or deleting a group

From **Manage → Config → Project Groups**:

- **Rename**: click the pencil icon next to the group name, type the new
  name, press Enter
- **Delete**: click the trash icon. Projects inside the group are **not**
  deleted — they become ungrouped. A confirmation dialog warns you how many
  projects will be affected.

## When to use a group vs a workspace

| Scenario | Use |
|----------|-----|
| Separate companies / tenants | **Workspace** |
| Permissions vary per bucket | **Workspace** |
| Just visual organization inside one company | **Project Group** |
| Cross-functional teams sharing projects | **Project Group** |

## Tips

- Use color to encode meaning at a glance: red for client work, blue for
  internal, amber for experimental
- Keep group names short — they show up in filter dropdowns
- An empty group is fine. Create it before you have projects so you can
  assign from the start
    `,
    tags: ['project-groups', 'organize', 'collections', 'workspace', 'filter'],
    order: 9,
    updatedAt: '2026-04-11',
    relatedSlugs: ['client-portal'],
  },
  {
    slug: 'status-timeline',
    categorySlug: 'features',
    title: 'Task Status Timeline',
    summary:
      'See every status transition for a task with who made the change and when.',
    content: `
## Overview

The Status Timeline tab on any task detail page shows every time the task moved
between statuses. It's a chronological record: who moved it, what they changed
it from, what they changed it to, and exactly when it happened.

## Where to find it

1. Open any task
2. Scroll to the **Status Timeline** section
3. Read the entries top-to-bottom

## What gets logged

- Initial creation (the first transition into whatever status the task started in)
- Every manual status change by any team member
- Status changes made by automations (the automation shows as the actor)
- Bulk operations that changed this task's status

## What does NOT get logged here

- Other field changes (assignee, due date, priority) — those live in the
  **Activity** tab, which shows a broader edit history
- Comments
- Status transitions in linked tasks or subtasks

## When it's useful

- **Audit trail** for compliance: "who closed this task and when?"
- **Diagnosing regressions**: "why was this moved back to In Progress twice?"
- **Estimating cycle time**: look at the timestamps between Open and Done
- **Debugging automations**: confirm an automation actually fired the status
  change you expected

## Tips

- Hover any entry to see the full timestamp
- Use browser search (Ctrl+F) to find an actor by name
- If the timeline looks empty on an old task, it means the status hasn't been
  touched since the feature was added — the log starts recording on first change
    `,
    tags: ['status', 'timeline', 'history', 'audit', 'transitions', 'activity'],
    order: 10,
    updatedAt: '2026-04-11',
    relatedSlugs: ['project-groups'],
  },
  {
    slug: 'time-logged-column',
    categorySlug: 'features',
    title: 'Time Logged column',
    summary:
      'See the total hours logged against each task right from the list view, without opening the task.',
    content: `
## Overview

Every task has a time tracker. The list view now shows a **Time Logged**
column summing every completed time entry for each task. No more opening
each task to check how many hours have been burned.

## Where to find it

- Open any project
- Switch to **List** view
- The Time Logged column shows between Priority and Due Date

## What's counted

- Every time entry that has been stopped (you pressed Stop, or entered hours
  manually)
- Entries are summed regardless of who logged them
- Both billable and non-billable entries are included

## What's NOT counted

- **Running timers** are excluded. A timer that's currently running doesn't
  contribute until you stop it. Check the Timer widget for live elapsed
  time.
- Deleted time entries are excluded (as expected)
- Time logged on **subtasks** is not rolled up to the parent — each task
  shows only its own hours

## Formatting

- 0 minutes → displayed as "—"
- 45 minutes → "0h 45m"
- 90 minutes → "1h 30m"
- 480 minutes → "8h 0m"

## Tips

- Sort the column descending to find the tasks consuming the most time
- Combine with a date filter to see "time logged this week"
- If the number surprises you, open the task's **Time Tracking** section
  to audit individual entries
    `,
    tags: ['time-tracking', 'logged-hours', 'list-view', 'column', 'billing'],
    order: 11,
    updatedAt: '2026-04-11',
    relatedSlugs: ['status-timeline', 'kanban-boards'],
  },
];
