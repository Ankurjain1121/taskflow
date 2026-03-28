export type EmptyStateVariant =
  | 'board'
  | 'column'
  | 'column-filtered'
  | 'search'
  | 'tasks'
  | 'workspace'
  | 'my-tasks-done'
  | 'favorites'
  | 'notifications'
  | 'comments'
  | 'activity'
  | 'milestones'
  | 'time-tracking'
  | 'custom-fields'
  | 'api-keys'
  | 'teams'
  | 'labels'
  | 'generic';

export interface EmptyStateConfig {
  icon: string;
  colorScheme: 'primary' | 'success' | 'warning' | 'info' | 'muted';
  defaultTitle: string;
  defaultDescription: string;
  defaultCtaLabel: string;
  shortcutHint?: string;
}

export const EMPTY_STATE_CONFIGS: Record<EmptyStateVariant, EmptyStateConfig> =
  {
    board: {
      icon: 'pi pi-check-square',
      colorScheme: 'primary',
      defaultTitle: 'No tasks yet',
      defaultDescription: 'Create your first task to get started.',
      defaultCtaLabel: 'Create Task',
    },
    column: {
      icon: 'pi pi-inbox',
      colorScheme: 'primary',
      defaultTitle: 'No tasks yet',
      defaultDescription: 'Drag tasks here or create a new one to get started.',
      defaultCtaLabel: 'Add Task',
      shortcutHint: 'N',
    },
    'column-filtered': {
      icon: 'pi pi-filter-slash',
      colorScheme: 'muted',
      defaultTitle: 'No matching tasks',
      defaultDescription:
        'Try adjusting your filters to see tasks in this column.',
      defaultCtaLabel: 'Clear Filters',
      shortcutHint: 'C',
    },
    search: {
      icon: 'pi pi-search',
      colorScheme: 'muted',
      defaultTitle: 'No results found',
      defaultDescription: 'Try different keywords or check your spelling.',
      defaultCtaLabel: '',
    },
    tasks: {
      icon: 'pi pi-check-circle',
      colorScheme: 'success',
      defaultTitle: 'All caught up',
      defaultDescription: 'No tasks assigned to you right now. Enjoy the calm!',
      defaultCtaLabel: '',
    },
    workspace: {
      icon: 'pi pi-building',
      colorScheme: 'primary',
      defaultTitle: 'Your workspace awaits',
      defaultDescription:
        'Create your first workspace and start organizing your projects.',
      defaultCtaLabel: 'Create Workspace',
    },
    'my-tasks-done': {
      icon: 'pi pi-star',
      colorScheme: 'success',
      defaultTitle: 'All done!',
      defaultDescription: 'You have completed all your tasks. Great work!',
      defaultCtaLabel: '',
    },
    favorites: {
      icon: 'pi pi-star',
      colorScheme: 'warning',
      defaultTitle: 'No favorites yet',
      defaultDescription:
        'Star tasks and projects to pin them here for quick access.',
      defaultCtaLabel: '',
    },
    notifications: {
      icon: 'pi pi-bell',
      colorScheme: 'muted',
      defaultTitle: 'No notifications',
      defaultDescription:
        'You are all caught up! New updates will appear here.',
      defaultCtaLabel: '',
    },
    comments: {
      icon: 'pi pi-comments',
      colorScheme: 'info',
      defaultTitle: 'No comments yet',
      defaultDescription:
        'Start the conversation -- share an update or ask a question.',
      defaultCtaLabel: '',
    },
    activity: {
      icon: 'pi pi-history',
      colorScheme: 'muted',
      defaultTitle: 'No activity yet',
      defaultDescription:
        'Changes to this item will appear here as they happen.',
      defaultCtaLabel: '',
    },
    milestones: {
      icon: 'pi pi-flag',
      colorScheme: 'primary',
      defaultTitle: 'No milestones yet',
      defaultDescription:
        'Create milestones to track major project checkpoints and deadlines.',
      defaultCtaLabel: 'Create Milestone',
    },
    'time-tracking': {
      icon: 'pi pi-clock',
      colorScheme: 'info',
      defaultTitle: 'No time tracked',
      defaultDescription:
        'Start a timer on any task to track how long work takes.',
      defaultCtaLabel: '',
    },
    'custom-fields': {
      icon: 'pi pi-sliders-h',
      colorScheme: 'primary',
      defaultTitle: 'No custom fields yet',
      defaultDescription:
        'Add extra data to your tasks -- effort estimates, URLs, dropdowns, and more.',
      defaultCtaLabel: 'Create Field',
    },
    'api-keys': {
      icon: 'pi pi-key',
      colorScheme: 'warning',
      defaultTitle: 'No API keys yet',
      defaultDescription:
        'Generate an API key to integrate TaskBolt with other tools.',
      defaultCtaLabel: 'Generate Key',
    },
    teams: {
      icon: 'pi pi-users',
      colorScheme: 'primary',
      defaultTitle: 'No teams yet',
      defaultDescription:
        'Organize workspace members into teams for better collaboration.',
      defaultCtaLabel: 'Create Team',
    },
    labels: {
      icon: 'pi pi-tag',
      colorScheme: 'primary',
      defaultTitle: 'No labels yet',
      defaultDescription: 'Create labels to categorize and filter your tasks.',
      defaultCtaLabel: 'Create Label',
    },
    generic: {
      icon: 'pi pi-inbox',
      colorScheme: 'muted',
      defaultTitle: 'Nothing here yet',
      defaultDescription: '',
      defaultCtaLabel: '',
    },
  };
