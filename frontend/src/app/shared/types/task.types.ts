/**
 * @deprecated Canonical task types are defined in '@core/services/task.service.ts'.
 * These interfaces remain for backward compatibility with project/ components.
 * New code should import from the service directly.
 */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  due_date: string | null;
  project_id: string;
  column_id: string;
  position: string;
  display_id: string | null;
  parent_task_id: string | null;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskWithDetails {
  task: Task;
  assignees: TaskAssigneeInfo[];
  labels: TaskLabelInfo[];
  comments_count: number;
  attachments_count: number;
}

/** Flattened version for easier use in components */
export interface TaskCard {
  id: string;
  title: string;
  description: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  due_date: string | null;
  column_id: string;
  position: string;
  display_id: string | null;
  assignees: TaskAssigneeInfo[];
  labels: TaskLabelInfo[];
  comments_count: number;
  attachments_count: number;
}

export interface TaskAssigneeInfo {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

export interface TaskLabelInfo {
  id: string;
  name: string;
  color: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  column_id: string;
  assignee_ids?: string[];
  parent_task_id?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: string;
  due_date?: string | null;
}

export interface MoveTaskRequest {
  target_column_id: string;
  after_task_id?: string;
  before_task_id?: string;
}

export interface TaskFilters {
  search?: string;
  priority?: string;
  assignee_id?: string;
  label_id?: string;
  due_before?: string;
  due_after?: string;
}
