export interface CommandAction {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export const RECENT_SEARCHES_KEY = 'taskbolt_recent_searches';
export const MAX_RECENT_SEARCHES = 5;
export const SELECTED_BG = 'rgba(99,102,241,0.1)';
