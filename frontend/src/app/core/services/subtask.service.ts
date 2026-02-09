import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  position: string;
  task_id: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtaskProgress {
  completed: number;
  total: number;
}

export interface SubtaskListResponse {
  subtasks: Subtask[];
  progress: SubtaskProgress;
}

@Injectable({
  providedIn: 'root',
})
export class SubtaskService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  list(taskId: string): Observable<SubtaskListResponse> {
    return this.http.get<SubtaskListResponse>(
      `${this.apiUrl}/tasks/${taskId}/subtasks`
    );
  }

  create(taskId: string, title: string): Observable<Subtask> {
    return this.http.post<Subtask>(
      `${this.apiUrl}/tasks/${taskId}/subtasks`,
      { title }
    );
  }

  update(subtaskId: string, title: string): Observable<Subtask> {
    return this.http.put<Subtask>(`${this.apiUrl}/subtasks/${subtaskId}`, {
      title,
    });
  }

  toggle(subtaskId: string): Observable<Subtask> {
    return this.http.patch<Subtask>(
      `${this.apiUrl}/subtasks/${subtaskId}/toggle`,
      {}
    );
  }

  reorder(subtaskId: string, position: string): Observable<Subtask> {
    return this.http.put<Subtask>(
      `${this.apiUrl}/subtasks/${subtaskId}/reorder`,
      { position }
    );
  }

  delete(subtaskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/subtasks/${subtaskId}`);
  }
}
