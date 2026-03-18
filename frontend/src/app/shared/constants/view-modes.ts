export const VIEW_MODES = [
  { key: 'kanban', label: 'Board', icon: 'pi-th-large', route: 'kanban' },
  { key: 'list', label: 'List', icon: 'pi-list', route: 'list' },
  { key: 'table', label: 'Table', icon: 'pi-table', route: 'table' },
  { key: 'calendar', label: 'Calendar', icon: 'pi-calendar', route: 'calendar' },
  { key: 'gantt', label: 'Gantt', icon: 'pi-chart-bar', route: 'gantt' },
  { key: 'reports', label: 'Reports', icon: 'pi-chart-line', route: 'reports' },
  { key: 'time-report', label: 'Time', icon: 'pi-clock', route: 'time-report' },
  { key: 'activity', label: 'Activity', icon: 'pi-history', route: 'activity' },
] as const;

export type ViewMode = (typeof VIEW_MODES)[number]['key'];
