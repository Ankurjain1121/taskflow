import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  position: string;
  task_id: string;
  assigned_to_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtaskWithAssignee extends Subtask {
  assignee_name: string | null;
  assignee_avatar_url: string | null;
}

export interface SubtaskProgress {
  completed: number;
  total: number;
}

export interface SubtaskListResponse {
  subtasks: SubtaskWithAssignee[];
  progress: SubtaskProgress;
}

export interface CreateSubtaskRequest {
  title: string;
  assigned_to_id?: string;
  due_date?: string;
}

export interface UpdateSubtaskRequest {
  title?: string;
  assigned_to_id?: string;
  due_date?: string;
  clear_assigned_to?: boolean;
  clear_due_date?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SubtaskService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  list(taskId: string): Observable<SubtaskListResponse> {
    return this.http.get<SubtaskListResponse>(
      `${this.apiUrl}/tasks/${taskId}/subtasks`,
    );
  }

  create(
    taskId: string,
    title: string,
    assignedToId?: string,
    dueDate?: string,
  ): Observable<Subtask> {
    const body: CreateSubtaskRequest = { title };
    if (assignedToId) body.assigned_to_id = assignedToId;
    if (dueDate) body.due_date = dueDate;
    return this.http.post<Subtask>(
      `${this.apiUrl}/tasks/${taskId}/subtasks`,
      body,
    );
  }

  update(
    subtaskId: string,
    request: UpdateSubtaskRequest,
  ): Observable<Subtask> {
    return this.http.put<Subtask>(
      `${this.apiUrl}/subtasks/${subtaskId}`,
      request,
    );
  }

  toggle(subtaskId: string): Observable<Subtask> {
    return this.http.patch<Subtask>(
      `${this.apiUrl}/subtasks/${subtaskId}/toggle`,
      {},
    );
  }

  reorder(subtaskId: string, position: string): Observable<Subtask> {
    return this.http.put<Subtask>(
      `${this.apiUrl}/subtasks/${subtaskId}/reorder`,
      { position },
    );
  }

  delete(subtaskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/subtasks/${subtaskId}`);
  }

  promote(subtaskId: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/subtasks/${subtaskId}/promote`, {});
  }
}
