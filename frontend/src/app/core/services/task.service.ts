import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { CacheService } from './cache.service';
import {
  TaskWithDetails as TaskDetailResponse,
  TaskFilters,
  MoveTaskRequest as ProjectMoveRequest,
  CreateTaskRequest as ProjectCreateRequest,
  UpdateTaskRequest as ProjectUpdateRequest,
} from '../../shared/types/task.types';

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
  watchers: Watcher[];
  labels: Label[];
  comments_count: number;
  attachments_count: number;
}

export interface Task {
  id: string;
  column_id: string;
  group_id?: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: string;
  milestone_id: string | null;
  task_number?: number | null;
  assignee_id: string | null;
  due_date: string | null;
  created_by: string;
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
  column_entered_at?: string;
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
  column_id?: string;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  group_id?: string;
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
  clear_due_date?: boolean;
  milestone_id?: string | null;
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
  group_id?: string;
  clear_group?: boolean;
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

  createTask(boardId: string, request: CreateTaskRequest): Observable<Task> {
    return this.http
      .post<Task>(`${this.apiUrl}/boards/${boardId}/tasks`, request)
      .pipe(
        tap(() => {
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:${boardId}:.*`);
        }),
      );
  }

  updateTask(taskId: string, request: UpdateTaskRequest): Observable<Task> {
    return this.http
      .patch<Task>(`${this.apiUrl}/tasks/${taskId}`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task:${taskId}`);
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
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
          this.cache.invalidateKey(`task:${taskId}`);
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
        }),
      );
  }

  deleteTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${taskId}`).pipe(
      tap(() => {
        this.cache.invalidateKey(`task:${taskId}`);
        this.cache.invalidate(`tasks:.*`);
        this.cache.invalidate(`board-full:.*`);
      }),
    );
  }

  addLabel(taskId: string, labelId: string): Observable<void> {
    return this.http
      .post<void>(`${this.apiUrl}/tasks/${taskId}/labels/${labelId}`, {})
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task:${taskId}`);
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
        }),
      );
  }

  removeLabel(taskId: string, labelId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/tasks/${taskId}/labels/${labelId}`)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task:${taskId}`);
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
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

  listByBoard(boardId: string): Observable<Record<string, Task[]>> {
    return this.cache.get(
      `board-tasks:${boardId}`,
      () =>
        this.http
          .get<{
            tasks: Record<string, Task[]>;
          }>(`${this.apiUrl}/boards/${boardId}/tasks`)
          .pipe(map((response) => response.tasks)),
      60000, // 1 min TTL
    );
  }

  listFlat(boardId: string): Observable<TaskListItem[]> {
    return this.cache.get(
      `flat-tasks:${boardId}`,
      () =>
        this.http.get<TaskListItem[]>(
          `${this.apiUrl}/boards/${boardId}/tasks/list`,
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
          this.cache.invalidateKey(`task:${taskId}`);
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
        }),
      );
  }

  unassignUser(taskId: string, userId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/tasks/${taskId}/assignees/${userId}`)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task:${taskId}`);
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
        }),
      );
  }

  listCalendarTasks(
    boardId: string,
    start: string,
    end: string,
  ): Observable<CalendarTask[]> {
    return this.cache.get(
      `calendar-tasks:${boardId}:${start}:${end}`,
      () =>
        this.http.get<CalendarTask[]>(
          `${this.apiUrl}/boards/${boardId}/tasks/calendar`,
          { params: { start, end } },
        ),
      180000, // 3 min TTL
    );
  }

  listGanttTasks(boardId: string): Observable<GanttTask[]> {
    return this.cache.get(
      `gantt-tasks:${boardId}`,
      () =>
        this.http.get<GanttTask[]>(
          `${this.apiUrl}/boards/${boardId}/tasks/gantt`,
        ),
      120000, // 2 min TTL
    );
  }

  bulkUpdate(
    boardId: string,
    request: BulkUpdateRequest,
  ): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(
      `${this.apiUrl}/boards/${boardId}/tasks/bulk-update`,
      request,
    );
  }

  bulkDelete(
    boardId: string,
    request: BulkDeleteRequest,
  ): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(
      `${this.apiUrl}/boards/${boardId}/tasks/bulk-delete`,
      request,
    );
  }

  // --- Methods used by project/ components (task.types.ts shapes) ---

  getTaskDetails(taskId: string): Observable<TaskDetailResponse> {
    return this.cache.get(
      `task-details:${taskId}`,
      () =>
        this.http.get<TaskDetailResponse>(
          `${this.apiUrl}/tasks/${taskId}/details`,
        ),
      60000, // 1 min TTL
    );
  }

  listByProject(
    projectId: string,
    filters?: TaskFilters,
  ): Observable<TaskDetailResponse[]> {
    let params = new HttpParams();
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value != null && value !== '') {
          params = params.set(key, String(value));
        }
      }
    }
    // Build cache key from filters
    const filterKey = filters ? JSON.stringify(filters) : 'no-filters';
    return this.cache.get(
      `project-tasks:${projectId}:${filterKey}`,
      () =>
        this.http.get<TaskDetailResponse[]>(
          `${this.apiUrl}/projects/${projectId}/tasks`,
          { params },
        ),
      60000, // 1 min TTL
    );
  }

  moveTaskPosition(
    taskId: string,
    request: ProjectMoveRequest,
  ): Observable<Task> {
    return this.http
      .patch<Task>(`${this.apiUrl}/tasks/${taskId}/move`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`task:${taskId}`);
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
        }),
      );
  }

  createProjectTask(
    projectId: string,
    request: ProjectCreateRequest,
  ): Observable<Task> {
    return this.http
      .post<Task>(`${this.apiUrl}/projects/${projectId}/tasks`, request)
      .pipe(
        tap(() => {
          this.cache.invalidate(`project-tasks:${projectId}:.*`);
        }),
      );
  }

  listSubtasks(parentTaskId: string): Observable<TaskDetailResponse[]> {
    return this.cache.get(
      `subtasks:${parentTaskId}`,
      () =>
        this.http.get<TaskDetailResponse[]>(
          `${this.apiUrl}/tasks/${parentTaskId}/subtasks`,
        ),
      60000, // 1 min TTL
    );
  }

  createSubtask(
    parentTaskId: string,
    request: { title: string; priority?: string },
  ): Observable<Task> {
    return this.http
      .post<Task>(`${this.apiUrl}/tasks/${parentTaskId}/subtasks`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`subtasks:${parentTaskId}`);
          this.cache.invalidateKey(`task-details:${parentTaskId}`);
        }),
      );
  }

  duplicateTask(taskId: string): Observable<Task> {
    return this.http
      .post<Task>(`${this.apiUrl}/tasks/${taskId}/duplicate`, {})
      .pipe(
        tap(() => {
          this.cache.invalidate(`tasks:.*`);
          this.cache.invalidate(`board-full:.*`);
        }),
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
      .post<{
        success: boolean;
        id: string;
      }>(`${this.apiUrl}/tasks/${taskId}/reminders`, { remind_before_minutes: remindBeforeMinutes })
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
}
