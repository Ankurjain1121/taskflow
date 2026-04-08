import { HelpArticle } from '../../models/help-article.model';

export const GETTING_STARTED_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'create-a-workspace',
    categorySlug: 'getting-started',
    title: 'Create a Workspace',
    summary: 'Workspaces organize your projects and team. Start by creating one from the sidebar.',
    videoUrl: '/videos/01-dashboard-overview.mp4',
    content: `
## What is a Workspace?

A workspace is the top-level container for all your projects and team members. Think of it as your company or department — everything lives inside a workspace.

## Creating Your First Workspace

1. Click the **workspace selector** in the sidebar (top-left corner)
2. Click **"Create Workspace"**
3. Enter a name for your workspace (e.g., "Engineering Team" or "Marketing")
4. Click **Create**

Your workspace is ready! You'll be redirected to the dashboard where you can start adding projects.

## Workspace Settings

To manage your workspace later, click **Manage** in the sidebar footer. From there you can:

- Rename your workspace
- Invite team members
- Configure workspace-level settings
- View activity logs

## Tips

- You can be a member of multiple workspaces
- Switch between workspaces using the workspace selector in the sidebar
- Each workspace has its own set of projects, members, and settings
    `,
    tags: ['workspace', 'setup', 'onboarding', 'create'],
    order: 1,
    updatedAt: '2026-04-08',
    relatedSlugs: ['add-a-project', 'invite-your-team'],
  },
  {
    slug: 'add-a-project',
    categorySlug: 'getting-started',
    title: 'Add a Project',
    summary: 'Projects contain your tasks organized in columns. Use kanban, list, or calendar views.',
    content: `
## What is a Project?

A project is where your tasks live, organized into columns on a kanban board. Each project can have its own columns, labels, and settings.

## Creating a Project

1. In the sidebar, click the **"+" button** next to "Projects"
2. Enter a project name
3. Choose a color for easy identification
4. Click **Create**

## Project Views

Each project supports multiple views:

- **Board View** — Kanban-style columns with drag-and-drop cards
- **List View** — Table-style list with sortable columns
- **Calendar View** — Tasks plotted on a monthly/weekly calendar

## Using Templates

Speed up project creation with templates:

1. Go to **Templates** from the sidebar
2. Browse available templates (Scrum, Bug Tracking, etc.)
3. Click **Use Template** to create a project with pre-configured columns

## Tips

- Star projects to pin them to the top of your sidebar
- Right-click a project for quick actions (rename, archive, settings)
- Drag projects in the sidebar to reorder them
    `,
    tags: ['project', 'board', 'kanban', 'create', 'template'],
    order: 2,
    updatedAt: '2026-04-08',
    relatedSlugs: ['create-a-workspace', 'create-tasks'],
  },
  {
    slug: 'create-tasks',
    categorySlug: 'getting-started',
    title: 'Create Tasks',
    summary: 'Add tasks to your project, set priorities, due dates, and assign team members.',
    videoUrl: '/videos/03-create-task.mp4',
    content: `
## Adding a Task

There are several ways to create a task:

### Quick Add
- Click the **"+ Add task"** button at the bottom of any column
- Type a task title and press **Enter**

### Detailed Creation
- Click the **"+"** button in the project header
- Fill in title, description, assignee, priority, due date, and labels
- Click **Create**

### Keyboard Shortcut
- Press **N** while on a project board to open the quick-create dialog

## Task Properties

| Property | Description |
|----------|-------------|
| **Title** | The task name (required) |
| **Description** | Rich text details, checklists, and attachments |
| **Assignee** | Who's responsible for the task |
| **Priority** | None, Low, Medium, High, Urgent |
| **Due Date** | When the task should be completed |
| **Labels** | Color-coded tags for categorization |
| **Status** | Automatically set by the column the task is in |

## Moving Tasks

- **Drag and drop** cards between columns to change status
- Click a task to open it, then change the status dropdown
- Use keyboard shortcuts: press **M** then select a column

## Tips

- Use **subtasks** for breaking down complex work
- Add **checklists** inside task descriptions for step-by-step items
- **@mention** team members in comments to notify them
    `,
    tags: ['task', 'create', 'priority', 'assignee', 'due date', 'labels'],
    order: 3,
    updatedAt: '2026-04-08',
    relatedSlugs: ['add-a-project', 'kanban-boards'],
  },
  {
    slug: 'invite-your-team',
    categorySlug: 'getting-started',
    title: 'Invite Your Team',
    summary: 'Add team members via email so you can collaborate on projects together.',
    content: `
## Inviting Team Members

1. Go to **Manage** (sidebar footer) or **Admin > Users**
2. Click **"Invite Member"**
3. Enter their email address
4. Select a role (Member or Admin)
5. Click **Send Invite**

The invitee will receive an email with a link to join your workspace.

## Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — manage members, settings, billing |
| **Member** | Create/edit projects and tasks, view reports |

## Managing Members

From the Manage page you can:

- View all workspace members and their roles
- Change a member's role
- Remove members from the workspace
- Resend pending invitations

## Tips

- Members can be assigned to tasks across any project in the workspace
- Use the **People** page to see workload and activity per member
- Members receive notifications for tasks they're assigned to or mentioned in
    `,
    tags: ['team', 'invite', 'members', 'roles', 'collaboration'],
    order: 4,
    updatedAt: '2026-04-08',
    relatedSlugs: ['create-a-workspace'],
  },
];
