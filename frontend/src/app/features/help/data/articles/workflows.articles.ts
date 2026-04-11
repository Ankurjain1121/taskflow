import { HelpArticle } from '../../models/help-article.model';

export const WORKFLOWS_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'organizing-with-labels',
    categorySlug: 'workflows',
    title: 'Organizing with Labels',
    summary: 'Use color-coded labels to categorize and filter tasks effectively.',
    content: `
## What are Labels?

Labels are color-coded tags you attach to tasks for categorization. Unlike columns (which represent workflow stages), labels represent task attributes like type, area, or team.

## Creating Labels

1. Open **Project Settings**
2. Go to **Labels**
3. Click **Add Label**
4. Choose a color and enter a name (e.g., "Bug", "Feature", "Design")

## Using Labels

- Add labels when creating or editing a task
- A task can have multiple labels
- Filter your board by label to focus on specific types of work

## Label Strategies

| Strategy | Example Labels |
|----------|---------------|
| **By Type** | Bug, Feature, Improvement, Docs |
| **By Area** | Frontend, Backend, Database, DevOps |
| **By Team** | Design, Engineering, QA, Product |
| **By Effort** | Quick Win, Medium, Large |

## Tips

- Keep labels consistent across projects for cross-project filtering
- Use label colors meaningfully (e.g., red for bugs, blue for features)
- Don't over-label — 5-10 labels per project is usually enough
    `,
    tags: ['labels', 'tags', 'categorize', 'filter', 'organize'],
    order: 1,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'effective-task-descriptions',
    categorySlug: 'workflows',
    title: 'Writing Effective Task Descriptions',
    summary: 'Best practices for writing clear, actionable task descriptions.',
    content: `
## Why Good Descriptions Matter

A well-written task description saves time by reducing back-and-forth questions. It should tell the assignee exactly what needs to be done.

## Template

Use this structure for most tasks:

### What
A clear, one-sentence summary of what needs to happen.

### Why
Brief context on why this is important or what problem it solves.

### Acceptance Criteria
A checklist of conditions that must be true for the task to be considered done:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Notes
Any additional context, links, screenshots, or constraints.

## Tips

- Use the rich text editor for formatting — headers, lists, and code blocks improve readability
- Attach screenshots or mockups for visual tasks
- Link related tasks using @mentions
- Keep descriptions updated as requirements change
    `,
    tags: ['description', 'writing', 'best practices', 'documentation'],
    order: 2,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'keyboard-shortcuts-guide',
    categorySlug: 'workflows',
    title: 'Keyboard Shortcuts Guide',
    summary: 'Master keyboard shortcuts to navigate and manage tasks faster.',
    content: `
## Why Use Shortcuts?

Keyboard shortcuts let you navigate TaskBolt without touching the mouse. Power users report being 2-3x faster with shortcuts.

## Essential Shortcuts

| Shortcut | Action |
|----------|--------|
| **N** | Create new task |
| **/** | Focus search bar |
| **?** | Show all shortcuts |
| **G then D** | Go to Dashboard |
| **G then B** | Go to Board |

## Navigation

| Shortcut | Action |
|----------|--------|
| **Arrow keys** | Move between cards |
| **Enter** | Open selected card |
| **Escape** | Close dialog / go back |

## Task Actions

| Shortcut | Action |
|----------|--------|
| **E** | Edit task |
| **M** | Move to column |
| **A** | Assign |
| **P** | Set priority |
| **L** | Add label |
| **Ctrl+Shift+↑** | Create task above focused row |
| **Ctrl+Shift+↓** | Create task below focused row |

## Discovering Shortcuts

Press **?** anywhere in TaskBolt to open the keyboard shortcuts reference. Shortcuts are context-aware — different shortcuts appear depending on which view you're on.

## Tips

- Shortcuts are shown in tooltips when you hover over buttons
- You can customize shortcuts from Settings > Keyboard
- Learn 2-3 new shortcuts per week for gradual mastery
    `,
    tags: ['keyboard', 'shortcuts', 'navigation', 'productivity', 'speed'],
    order: 3,
    updatedAt: '2026-04-11',
  },
  {
    slug: 'managing-priorities',
    categorySlug: 'workflows',
    title: 'Managing Priorities',
    summary: 'Use the priority system and Eisenhower matrix to focus on what matters.',
    content: `
## Priority Levels

TaskBolt uses five priority levels:

| Priority | When to Use |
|----------|-------------|
| **Urgent** | Critical blocker, needs immediate attention |
| **High** | Important, should be done this sprint |
| **Medium** | Normal priority, scheduled work |
| **Low** | Nice to have, do when time allows |
| **None** | Not yet triaged |

## Eisenhower Matrix

Access the **Eisenhower Matrix** from the sidebar (or press **G then E**) to see your tasks organized by urgency and importance:

- **Do First** — Urgent + Important
- **Schedule** — Important, not Urgent
- **Delegate** — Urgent, not Important
- **Eliminate** — Neither Urgent nor Important

## Tips

- Triage new tasks immediately — don't leave them as "None" priority
- Review priorities weekly to keep them current
- Use priority-based board coloring to spot urgent items at a glance
- Combine priority with due dates for effective scheduling
    `,
    tags: ['priority', 'eisenhower', 'matrix', 'urgent', 'important', 'focus'],
    order: 4,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'linking-tasks-and-issues',
    categorySlug: 'workflows',
    title: 'Linking Tasks and Issues',
    summary:
      'Connect a bug report to the task that tracks fixing it. Links are bidirectional and visible from both sides.',
    content: `
## Overview

Tasks track planned work. Issues track bugs and feature requests. Often a
single piece of work connects both: a customer files a bug, your team creates
a task to fix it, and you want to jump between the two without copying text
back and forth.

TaskBolt lets you link any task to any issue as long as they're in the same
project. The link is bidirectional: you set it once from either side and
both detail pages show the other.

## Linking from a task

1. Open the task detail page
2. Scroll to the **Linked Issues** section (under Dependencies)
3. Click **+ Link issue**
4. Search by title. The dropdown filters to issues in the same project
5. Click the issue you want to link

The issue appears in the Linked Issues list immediately. Open the issue and
you'll see the task under **Linked Tasks** on its detail page.

## Unlinking

From the task side, click the × icon next to any linked issue. The link is
removed on both sides instantly. Unlinking does not delete either entity.

## Rules

- Both entities must be in the **same project**. Cross-project linking is
  planned for a future release
- A task can be linked to multiple issues, and vice versa
- Attempting to link the same pair twice is a no-op, not an error
- Deleting a task or issue automatically removes all its links

## When to link

- **Bug fix in progress**: user files a bug (issue), engineer starts working
  on the fix (task). Link them so PMs can track the fix from either side
- **Feature request → implementation**: a feature request issue links to all
  the tasks that implement it
- **Regression tracking**: if a new issue resurfaces an old closed issue, link
  the old issue to the task investigating the regression

## Tips

- Link early. The value of a link is highest when both sides are still active
- Use the issue's severity badge in the task detail as a priority signal —
  a critical-severity linked issue is a stronger "drop everything" signal
  than just task priority
- If you find yourself linking 10+ issues to a single task, consider
  grouping them under a milestone instead
    `,
    tags: ['linking', 'tasks', 'issues', 'bugs', 'relationships', 'workflow'],
    order: 5,
    updatedAt: '2026-04-11',
    relatedSlugs: ['priority-management'],
  },
];
