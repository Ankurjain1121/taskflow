import { HelpArticle } from '../../models/help-article.model';

export const TROUBLESHOOTING_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'tasks-not-appearing',
    categorySlug: 'troubleshooting',
    title: 'Tasks Not Appearing',
    summary: 'Tasks are missing from your board? Check filters, columns, and permissions.',
    content: `
## Common Causes

### Active Filters
The most common reason. Check if you have filters active:
1. Look for a **filter badge** in the board toolbar
2. Click **Clear Filters** to remove all active filters
3. Tasks should reappear

### Wrong Column View
Tasks might be in a collapsed column:
- Click the column header to expand collapsed columns
- Check if the task's status matches any visible column

### Archived Tasks
Tasks may have been archived:
1. Go to **Archive** from the sidebar
2. Search for the task
3. Click **Restore** to bring it back to the board

### Permission Issues
If you can't see tasks created by others:
- Check that you're a member of the project
- Ask an admin to verify your project access

## Still Missing?

If tasks are still not appearing, try:
1. **Hard refresh** the page (Ctrl+Shift+R)
2. **Clear browser cache** for the site
3. Contact support at support@paraslace.in
    `,
    tags: ['missing', 'tasks', 'filters', 'hidden', 'not showing'],
    order: 1,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'slow-performance',
    categorySlug: 'troubleshooting',
    title: 'Slow Performance',
    summary: 'Board loading slowly? Here are tips to improve speed.',
    content: `
## Quick Fixes

1. **Reduce visible tasks** — Use filters to show only relevant tasks
2. **Close unused tabs** — Multiple TaskBolt tabs share the same connection
3. **Hard refresh** — Ctrl+Shift+R clears cached assets

## Browser Tips

- Use Chrome or Edge for best performance
- Disable browser extensions that may interfere
- Keep your browser updated

## Large Projects

If your project has 500+ tasks:
- Archive completed tasks regularly
- Use filters to limit visible items
- Consider splitting into sub-projects

## Tips

- TaskBolt uses WebSocket for real-time updates — a stable internet connection helps
- If issues persist, check if your organization's firewall blocks WebSocket connections
    `,
    tags: ['slow', 'performance', 'loading', 'speed', 'lag'],
    order: 2,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'notification-issues',
    categorySlug: 'troubleshooting',
    title: 'Notification Issues',
    summary: 'Not receiving notifications? Check your settings and browser permissions.',
    content: `
## Check Your Settings

1. Go to **Settings > Notifications**
2. Verify that notifications are enabled for the events you care about
3. Check both **email** and **in-app** notification toggles

## Browser Notifications

If in-app notifications aren't showing:
1. Check that browser notifications are **allowed** for the site
2. Look for the bell icon in the top-right — unread count appears there
3. Click the bell to see recent notifications

## Email Notifications

If emails aren't arriving:
1. Check your **spam/junk** folder
2. Add support@paraslace.in to your contacts
3. Verify your email address in **Settings > Profile**

## Tips

- You won't get notifications for your own actions
- @mentions always trigger a notification regardless of settings
- Notification preferences are per-user, not per-workspace
    `,
    tags: ['notifications', 'email', 'alerts', 'not receiving'],
    order: 3,
    updatedAt: '2026-04-08',
  },
  {
    slug: 'import-export',
    categorySlug: 'troubleshooting',
    title: 'Importing & Exporting Data',
    summary: 'Move tasks in and out of TaskBolt using CSV and JSON formats.',
    content: `
## Importing Tasks

1. Open your project
2. Go to **Project Settings > Import/Export**
3. Click **Import**
4. Upload a CSV or JSON file
5. Map columns to TaskBolt fields
6. Click **Import**

### CSV Format

Your CSV should have headers matching task fields:

\`\`\`
title,description,priority,status,assignee_email,due_date
"Fix login bug","Users can't log in",high,todo,dev@example.com,2026-04-15
\`\`\`

## Exporting Tasks

1. Go to **Project Settings > Import/Export**
2. Click **Export**
3. Choose format (CSV or JSON)
4. Download the file

## Tips

- Export before making bulk changes as a backup
- Use CSV for spreadsheet tools (Excel, Google Sheets)
- Use JSON for programmatic access or API integration
    `,
    tags: ['import', 'export', 'csv', 'json', 'data', 'migration'],
    order: 4,
    updatedAt: '2026-04-08',
  },
];
