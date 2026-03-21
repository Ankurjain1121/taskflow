export interface FocusTask {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  due_date: string | null;
  project_id: string;
  project_name: string;
  project_color: string | null;
  status_name: string;
  status_color: string;
  days_overdue: number | null;
  assignees: { id: string; name: string; avatar_url: string | null }[];
}

export interface ProjectPulse {
  project_id: string;
  project_name: string;
  project_color: string | null;
  active_tasks: number;
  overdue_tasks: number;
  completed_this_week: number;
  health: 'green' | 'amber' | 'red';
  sparkline: number[];
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  completed_today: number;
}

export interface SnoozedTaskEntry {
  snoozedUntil: string; // ISO date string
}

export type SnoozedTasksMap = Record<string, SnoozedTaskEntry>;
