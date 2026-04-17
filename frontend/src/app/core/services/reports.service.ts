import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CompletionRate {
  total: number;
  completed: number;
  remaining: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  total_tasks: number;
  remaining_tasks: number;
}

export interface ResourceUtilizationEntry {
  user_id: string;
  user_name: string;
  total_estimated_hours: number;
  total_actual_hours: number;
  task_count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface AssigneeWorkload {
  user_id: string;
  name: string;
  avatar_url: string | null;
  total_tasks: number;
  completed_tasks: number;
}

export interface OverdueBucket {
  bucket: string;
  count: number;
}

export interface BoardReport {
  completion_rate: CompletionRate;
  burndown: BurndownPoint[];
  priority_distribution: PriorityCount[];
  assignee_workload: AssigneeWorkload[];
  overdue_analysis: OverdueBucket[];
}

export interface BurndownDataPoint {
  date: string;
  total_tasks: number;
  completed_tasks: number;
  remaining: number;
  ideal_line: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  constructor(private http: HttpClient) {}

  getBoardReport(
    boardId: string,
    days: number = 30,
  ): Observable<BoardReport> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<BoardReport>(`/api/projects/${boardId}/reports`, {
      params,
    });
  }

  getBurndownChart(
    boardId: string,
    days: number = 30,
  ): Observable<BurndownDataPoint[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<BurndownDataPoint[]>(
      `/api/projects/${boardId}/charts/burndown`,
      { params },
    );
  }

  exportBurndownCsv(boardId: string, days: number = 30): Observable<Blob> {
    const params = new HttpParams()
      .set('days', days.toString())
      .set('format', 'csv');
    return this.http.get(
      `/api/projects/${boardId}/charts/burndown/export`,
      { params, responseType: 'blob' },
    );
  }

  getUtilizationByWorkspace(
    workspaceId: string,
  ): Observable<ResourceUtilizationEntry[]> {
    return this.http.get<ResourceUtilizationEntry[]>(
      `/api/workspaces/${workspaceId}/resource-utilization`,
    );
  }

}
