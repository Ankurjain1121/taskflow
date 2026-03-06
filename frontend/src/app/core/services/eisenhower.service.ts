import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type EisenhowerQuadrant =
  | 'do_first'
  | 'schedule'
  | 'delegate'
  | 'eliminate';

export interface EisenhowerAssignee {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface EisenhowerTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
  column_id: string;
  column_name: string;
  position: string;
  is_done: boolean;
  eisenhower_urgency: boolean | null;
  eisenhower_importance: boolean | null;
  quadrant: EisenhowerQuadrant;
  assignees: EisenhowerAssignee[];
  created_at: string;
  updated_at: string;
}

export interface EisenhowerMatrixResponse {
  do_first: EisenhowerTask[];
  schedule: EisenhowerTask[];
  delegate: EisenhowerTask[];
  eliminate: EisenhowerTask[];
}

export interface EisenhowerFilters {
  workspace_id?: string;
  project_id?: string;
  daily?: boolean;
}

export interface UpdateEisenhowerRequest {
  urgency: boolean | null;
  importance: boolean | null;
}

export interface ResetEisenhowerResponse {
  tasks_reset: number;
}

@Injectable({
  providedIn: 'root',
})
export class EisenhowerService {
  private readonly apiUrl = '/api/eisenhower';

  constructor(private http: HttpClient) {}

  getMatrix(filters?: EisenhowerFilters): Observable<EisenhowerMatrixResponse> {
    let params = new HttpParams();
    if (filters?.workspace_id) {
      params = params.set('workspace_id', filters.workspace_id);
    }
    if (filters?.project_id) {
      params = params.set('project_id', filters.project_id);
    }
    if (filters?.daily) {
      params = params.set('daily', 'true');
    }
    return this.http.get<EisenhowerMatrixResponse>(this.apiUrl, { params });
  }

  updateTaskOverride(
    taskId: string,
    urgency: boolean | null,
    importance: boolean | null,
  ): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tasks/${taskId}`, {
      urgency,
      importance,
    });
  }

  resetAllOverrides(): Observable<ResetEisenhowerResponse> {
    return this.http.put<ResetEisenhowerResponse>(`${this.apiUrl}/reset`, {});
  }
}
