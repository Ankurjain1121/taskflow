/** Minimal task shape accepted by the unified TaskCardComponent. */
export interface TaskCardData {
  id: string;
  title: string;
  status?: string | null;
  status_color?: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  due_date?: string | null;
  assignee?: { id: string; name: string; avatar_url?: string | null } | null;
  child_count?: number;
  completed_child_count?: number;
  project_name?: string | null;
  project_color?: string | null;
  task_number?: number | null;
}

export type TaskCardVariant = 'kanban' | 'timeline' | 'board' | 'compact';
