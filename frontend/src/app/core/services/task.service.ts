import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Assignee {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface TaskWithDetails {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: string;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees: Assignee[];
  labels: Label[];
  comments_count: number;
  attachments_count: number;
}

export interface Task {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: string;
  milestone_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees?: Assignee[];
  labels?: Label[];
  subtask_completed?: number;
  subtask_total?: number;
}

export interface TaskLabel {
  id: string;
  task_id: string;
  label_id: string;
}

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  column_id: string;
  column_name: string;
  position: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  milestone_id?: string;
  assignee_ids?: string[];
  label_ids?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  milestone_id?: string | null;
}

export interface CalendarTask {
  id: string;
  title: string;
  priority: string;
  due_date: string;
  start_date: string | null;
  column_id: string;
  column_name: string;
  is_done: boolean;
  milestone_id: string | null;
}

export interface GanttTask {
  id: string;
  title: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  column_id: string;
  column_name: string;
  is_done: boolean;
  milestone_id: string | null;
}

export interface MoveTaskRequest {
  column_id: string;
  position: string;
}

export interface BulkUpdateRequest {
  task_ids: string[];
  column_id?: string;
  priority?: TaskPriority;
  milestone_id?: string;
  clear_milestone?: boolean;
}

export interface BulkDeleteRequest {
  task_ids: string[];
}

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly apiUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  listTasks(columnId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/columns/${columnId}/tasks`);
  }

  getTask(taskId: string): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/tasks/${taskId}`);
  }

  createTask(columnId: string, request: CreateTaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/columns/${columnId}/tasks`, request);
  }

  updateTask(taskId: string, request: UpdateTaskRequest): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/tasks/${taskId}`, request);
  }

  moveTask(taskId: string, request: MoveTaskRequest): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/tasks/${taskId}/move`, request);
  }

  deleteTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${taskId}`);
  }

  addLabel(taskId: string, labelId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/tasks/${taskId}/labels/${labelId}`, {});
  }

  removeLabel(taskId: string, labelId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${taskId}/labels/${labelId}`);
  }

  getLabels(taskId: string): Observable<Label[]> {
    return this.http.get<Label[]>(`${this.apiUrl}/tasks/${taskId}/labels`);
  }

  listByBoard(boardId: string): Observable<Record<string, Task[]>> {
    return this.http.get<Record<string, Task[]>>(
      `${this.apiUrl}/boards/${boardId}/tasks`
    );
  }

  listFlat(boardId: string): Observable<TaskListItem[]> {
    return this.http.get<TaskListItem[]>(
      `${this.apiUrl}/boards/${boardId}/tasks/list`
    );
  }

  assignUser(taskId: string, userId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/tasks/${taskId}/assignees`,
      { user_id: userId }
    );
  }

  unassignUser(taskId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/tasks/${taskId}/assignees/${userId}`
    );
  }

  listCalendarTasks(boardId: string, start: string, end: string): Observable<CalendarTask[]> {
    return this.http.get<CalendarTask[]>(
      `${this.apiUrl}/boards/${boardId}/tasks/calendar`,
      { params: { start, end } }
    );
  }

  listGanttTasks(boardId: string): Observable<GanttTask[]> {
    return this.http.get<GanttTask[]>(
      `${this.apiUrl}/boards/${boardId}/tasks/gantt`
    );
  }

  bulkUpdate(boardId: string, request: BulkUpdateRequest): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(
      `${this.apiUrl}/boards/${boardId}/tasks/bulk-update`,
      request
    );
  }

  bulkDelete(boardId: string, request: BulkDeleteRequest): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(
      `${this.apiUrl}/boards/${boardId}/tasks/bulk-delete`,
      request
    );
  }
}
