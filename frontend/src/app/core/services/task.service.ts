import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { CacheService } from './cache.service';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Assignee {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Watcher {
  user_id: string;
  name: string;
  avatar_url: string | null;
  watched_at: string;
}

export interface TaskReminder {
  id: string;
  task_id: string;
  remind_before_minutes: number;
  is_sent: boolean;
  created_at: string;
}

export interface TaskWithDetails {
  id: string;
  /** @deprecated removed — use status_id */
  column_id?: string;
  status_id: string | null;
  project_id: string;
  task_list_id?: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: string;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees: Assignee[];
  watchers: Watcher[];
  labels: Label[];
  comments_count: number;
  attachments_count: number;
  parent_task_id?: string | null;
  depth?: number;
}

export interface Task {
  id: string;
  project_id: string;
  /** @deprecated removed — use status_id */
  column_id?: string;
  status_id?: string | null;
  status_name?: string | null;
  status_color?: string | null;
  status_type?: string | null;
  /** @deprecated use task_list_id */
  group_id?: string | null;
  task_list_id?: string | null;
  task_list_name?: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: string;
  milestone_id: string | null;
  task_number?: number | null;
  assignee_id?: string | null;
  due_date: string | null;
  created_by?: string;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
  version?: number;
  assignees?: Assignee[];
  watchers?: Watcher[];
  labels?: Label[];
  subtask_completed?: number;
  subtask_total?: number;
  has_running_timer?: boolean;
  comment_count?: number;
  attachment_count?: number;
  parent_task_id?: string | null;
  depth?: number;
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
  /** @deprecated use status_id */
  column_id?: string;
  /** @deprecated use status_name */
  column_name?: string;
  status_id: string | null;
  status_name: string | null;
  status_color: string | null;
  status_type: string | null;
  task_list_id: string | null;
  task_list_name: string | null;
  position: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status_id?: string;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  task_list_id?: string;
  milestone_id?: string;
  assignee_ids?: string[];
  label_ids?: string[];
  parent_task_id?: string;
}

export interface CreateChildTaskRequest {
  title: string;
  priority?: TaskPriority;
  description?: string;
  status_id?: string;
  assignee_ids?: string[];
  label_ids?: string[];
}

export interface ChildTaskListResponse {
  children: Task[];
  progress: { completed: number; total: number };
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  clear_due_date?: boolean;
  milestone_id?: string | null;
  status_id?: string | null;
  version?: number;
}

export interface ConflictError {
  status: 409;
  serverTask: Task;
}

export interface CalendarTask {
  id: string;
  title: string;
  priority: string;
  due_date: string;
  start_date: string | null;
  /** @deprecated use status_id */
  column_id?: string;
  /** @deprecated use status_name */
  column_name?: string;
  status_id: string | null;
  status_name: string | null;
  is_done: boolean;
  milestone_id: string | null;
}

export interface GanttTask {
  id: string;
  title: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  /** @deprecated use status_id */
  column_id?: string;
  /** @deprecated use status_name */
  column_name?: string;
  status_id: string | null;
  status_name: string | null;
  is_done: boolean;
  milestone_id: string | null;
}

export interface MoveTaskRequest {
  status_id?: string;
  position: string;
}

export interface BulkUpdateRequest {
  task_ids: string[];
  status_id?: string;
  priority?: TaskPriority;
  milestone_id?: string;
  clear_milestone?: boolean;
  task_list_id?: string;
  clear_task_list?: boolean;
}

export interface BulkDeleteRequest {
  task_ids: string[];
}

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly apiUrl = '/api';
  private cache = inject(CacheService);

  constructor(private http: HttpClient) {}

  listTasks(columnId: string): Observable<Task[]> {
    return this.cache.get(
      `tasks:${columnId}`,
      () => this.http.get<Task[]>(`${this.apiUrl}/columns/${columnId}/tasks`),
      60000, // 1 min TTL
    );
  }

  getTask(taskId: string): Observable<Task> {
    return this.cache.get(
      `task:${taskId}`,
      () => this.http.get<Task>(`${this.apiUrl}/tasks/${taskId}`),
      60000, // 1 min TTL
    );
  }

  createTask(projectId: string, request: CreateTaskRequest): Observable<Task> {
    return this.http
      .post<Task>(`${this.apiUrl}/boards/${projectId}/tasks`, request)
      .pipe(
        tap(() => {
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`project-full:${projectId}:.*`);
        }),
      );
  }

  updateTask(taskId: string, request: UpdateTaskRequest): Observable<Task> {
    return this.http
      .patch<Task>(`${this.apiUrl}/tasks/${taskId}`, request)
      .pipe(
        tap(() => {
          this.invalidateTaskAndProjectCaches(taskId);
        }),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 409 && error.error?.current_task) {
            const conflictErr: ConflictError = {
              status: 409,
              serverTask: error.error.current_task as Task,
            };
            return throwError(() => conflictErr);
          }
          return throwError(() => error);
        }),
      );
  }

  moveTask(taskId: string, request: MoveTaskRequest): Observable<Task> {
    return this.http
      .patch<Task>(`${this.apiUrl}/tasks/${taskId}/move`, request)
      .pipe(
        tap(() => {
          this.invalidateTaskAndProjectCaches(taskId);
        }),
      );
  }

  deleteTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${taskId}`).pipe(
      tap(() => {
        this.invalidateTaskAndProjectCaches(taskId);
      }),
    );
  }

  addLabel(taskId: string, labelId: string): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/tasks/${taskId}/labels/${labelId}`, {})
      .pipe(
        tap(() => {
          this.invalidateTaskAndProjectCaches(taskId);
        }),
      );
  }

  removeLabel(taskId: string, labelId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/tasks/${taskId}/labels/${labelId}`)
      .pipe(
        tap(() => {
          this.invalidateTaskAndProjectCaches(taskId);
        }),
      );
  }

  getLabels(taskId: string): Observable<Label[]> {
    return this.cache.get(
      `task-labels:${taskId}`,
      () => this.http.get<Label[]>(`${this.apiUrl}/tasks/${taskId}/labels`),
      120000, // 2 min TTL
    );
  }

  listByBoard(projectId: string): Observable<Record<string, Task[]>> {
    return this.cache.get(
      `project-tasks:${projectId}`,
      () =>
        this.http
          .get<{
            tasks: Record<string, Task[]>;
          }>(`${this.apiUrl}/boards/${projectId}/tasks`)
          .pipe(map((response) => response.tasks)),
      60000, // 1 min TTL
    );
  }

  listFlat(projectId: string): Observable<TaskListItem[]> {
    return this.cache.get(
      `flat-tasks:${projectId}`,
      () =>
        this.http.get<TaskListItem[]>(
          `${this.apiUrl}/boards/${projectId}/tasks/list`,
        ),
      60000, // 1 min TTL
    );
  }

  assignUser(taskId: string, userId: string): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/tasks/${taskId}/assignees`, {
        user_id: userId,
      })
      .pipe(
        tap(() => {
          this.invalidateTaskAndProjectCaches(taskId);
        }),
      );
  }

  unassignUser(taskId: string, userId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/tasks/${taskId}/assignees/${userId}`)
      .pipe(
        tap(() => {
          this.invalidateTaskAndProjectCaches(taskId);
        }),
      );
  }

  listCalendarTasks(
    projectId: string,
    start: string,
    end: string,
  ): Observable<CalendarTask[]> {
    return this.cache.get(
      `calendar-tasks:${projectId}:${start}:${end}`,
      () =>
        this.http.get<CalendarTask[]>(
          `${this.apiUrl}/boards/${projectId}/tasks/calendar`,
          { params: { start, end } },
        ),
      180000, // 3 min TTL
    );
  }

  listGanttTasks(projectId: string): Observable<GanttTask[]> {
    return this.cache.get(
      `gantt-tasks:${projectId}`,
      () =>
        this.http.get<GanttTask[]>(
          `${this.apiUrl}/boards/${projectId}/tasks/gantt`,
        ),
      120000, // 2 min TTL
    );
  }

  bulkUpdate(
    projectId: string,
    request: BulkUpdateRequest,
  ): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(
      `${this.apiUrl}/boards/${projectId}/tasks/bulk-update`,
      request,
    );
  }

  bulkDelete(
    projectId: string,
    request: BulkDeleteRequest,
  ): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(
      `${this.apiUrl}/boards/${projectId}/tasks/bulk-delete`,
      request,
    );
  }

  duplicateTask(taskId: string): Observable<Task> {
    return this.http
      .post<Task>(`${this.apiUrl}/tasks/${taskId}/duplicate`, {})
      .pipe(
        tap(() => {
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`project-full:.*`);
        }),
      );
  }

  // --- Child Tasks ---

  listChildren(taskId: string): Observable<ChildTaskListResponse> {
    return this.http.get<ChildTaskListResponse>(`${this.apiUrl}/tasks/${taskId}/children`);
  }

  createChild(parentTaskId: string, request: CreateChildTaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/tasks/${parentTaskId}/children`, request).pipe(
      tap(() => {
        this.invalidateTaskAndProjectCaches(parentTaskId);
      }),
    );
  }

  completeTask(taskId: string): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/tasks/${taskId}/complete`, {}).pipe(
      tap(() => { this.invalidateTaskAndProjectCaches(taskId); }),
    );
  }

  uncompleteTask(taskId: string): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/tasks/${taskId}/uncomplete`, {}).pipe(
      tap(() => { this.invalidateTaskAndProjectCaches(taskId); }),
    );
  }

  // --- Watchers ---

  addWatcher(taskId: string, userId: string): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/tasks/${taskId}/watchers`, {
        user_id: userId,
      })
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task-details:${taskId}`);
        }),
      );
  }

  removeWatcher(taskId: string, userId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/tasks/${taskId}/watchers/${userId}`)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task-details:${taskId}`);
        }),
      );
  }

  // --- Reminders ---

  setReminder(
    taskId: string,
    remindBeforeMinutes: number,
  ): Observable<{ success: boolean; id: string }> {
    return this.http
      .post<{ success: boolean; id: string }>(
        `${this.apiUrl}/tasks/${taskId}/reminders`,
        { remind_before_minutes: remindBeforeMinutes },
      )
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task-reminders:${taskId}`);
        }),
      );
  }

  listReminders(taskId: string): Observable<TaskReminder[]> {
    return this.cache.get(
      `task-reminders:${taskId}`,
      () =>
        this.http.get<TaskReminder[]>(
          `${this.apiUrl}/tasks/${taskId}/reminders`,
        ),
      120000, // 2 min TTL
    );
  }

  removeReminder(taskId: string, reminderId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/tasks/${taskId}/reminders/${reminderId}`)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task-reminders:${taskId}`);
        }),
      );
  }

  // --- Cache helpers ---

  private invalidateTaskAndProjectCaches(taskId: string): void {
    this.cache.invalidateKey(`task:${taskId}`);
    this.cache.invalidate(`tasks:.*`);
    this.cache.invalidate(`project-full:.*`);
  }
}
