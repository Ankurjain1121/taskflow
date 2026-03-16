import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaskPriority, Label, Assignee } from './task.service';
import { ColumnStatusMapping } from './project.service';

export interface MyTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  /** @deprecated use status_id */
  column_id?: string;
  /** @deprecated use status_name */
  column_name?: string;
  column_status_mapping?: ColumnStatusMapping | null;
  status_id: string | null;
  status_name: string | null;
  is_done: boolean;
  board_id: string;
  board_name: string;
  workspace_id: string;
  workspace_name?: string;
  labels?: Label[];
  assignees?: Assignee[];
  position: string;
  created_at: string;
  updated_at: string;
}

export interface MyTasksParams {
  sort_by?: 'due_date' | 'priority' | 'board' | 'created_at';
  sort_order?: 'asc' | 'desc';
  board_id?: string;
  cursor?: string;
  limit?: number;
}

export interface MyTasksResponse {
  items: MyTask[];
  next_cursor: string | null;
}

export interface MyTasksSummary {
  total_assigned: number;
  due_soon: number;
  overdue: number;
  completed_this_week: number;
}

@Injectable({
  providedIn: 'root',
})
export class MyTasksService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getMyTasks(params: MyTasksParams = {}): Observable<MyTasksResponse> {
    let httpParams = new HttpParams();

    if (params.sort_by) {
      httpParams = httpParams.set('sort_by', params.sort_by);
    }
    if (params.sort_order) {
      httpParams = httpParams.set('sort_order', params.sort_order);
    }
    if (params.board_id) {
      httpParams = httpParams.set('board_id', params.board_id);
    }
    if (params.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }

    return this.http.get<MyTasksResponse>(`${this.apiUrl}/my-tasks`, {
      params: httpParams,
    });
  }

  getMyTasksSummary(): Observable<MyTasksSummary> {
    return this.http.get<MyTasksSummary>(`${this.apiUrl}/my-tasks/summary`);
  }
}
