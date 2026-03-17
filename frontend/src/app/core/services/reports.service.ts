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

export interface BurnupPoint {
  date: string;
  total_scope: number;
  completed: number;
}

export interface ResourceEntry {
  user_id: string;
  user_name: string;
  task_count: number;
  hours_logged: number;
  week_start: string;
}

export interface ResourceUtilizationEntry {
  user_id: string;
  user_name: string;
  total_estimated_hours: number;
  total_actual_hours: number;
  task_count: number;
}

export interface CompletionRatePoint {
  week_start: string;
  completed: number;
  total: number;
}

export interface ReportJobStatus {
  status: 'pending' | 'completed' | 'failed';
  download_url?: string;
  error_message?: string;
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

  getBurndown(projectId: string, days: number): Observable<BurndownPoint[]> {
    const params = new HttpParams()
      .set('project_id', projectId)
      .set('days', days.toString());
    return this.http.get<BurndownPoint[]>('/api/reports/burndown', { params });
  }

  getBurnup(projectId: string, days: number): Observable<BurnupPoint[]> {
    const params = new HttpParams()
      .set('project_id', projectId)
      .set('days', days.toString());
    return this.http.get<BurnupPoint[]>('/api/reports/burnup', { params });
  }

  getResourceUtilization(
    workspaceId: string,
    weeks: number,
  ): Observable<ResourceEntry[]> {
    const params = new HttpParams()
      .set('workspace_id', workspaceId)
      .set('weeks', weeks.toString());
    return this.http.get<ResourceEntry[]>('/api/reports/resource', { params });
  }

  getUtilizationByWorkspace(
    workspaceId: string,
  ): Observable<ResourceUtilizationEntry[]> {
    return this.http.get<ResourceUtilizationEntry[]>(
      `/api/workspaces/${workspaceId}/resource-utilization`,
    );
  }

  getCompletionRate(
    projectId: string,
    weeks: number,
  ): Observable<CompletionRatePoint[]> {
    const params = new HttpParams()
      .set('project_id', projectId)
      .set('weeks', weeks.toString());
    return this.http.get<CompletionRatePoint[]>(
      '/api/reports/completion-rate',
      { params },
    );
  }

  exportCsv(
    projectId: string,
    reportType: string,
    days: number,
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('project_id', projectId)
      .set('report_type', reportType)
      .set('days', days.toString());
    return this.http.get('/api/reports/export/csv', {
      params,
      responseType: 'blob',
    });
  }

  requestPdfExport(
    projectId: string,
    reportType: string,
    days: number,
  ): Observable<{ job_id: string }> {
    return this.http.post<{ job_id: string }>('/api/reports/export/pdf', {
      project_id: projectId,
      report_type: reportType,
      days,
    });
  }

  getPdfStatus(jobId: string): Observable<ReportJobStatus> {
    return this.http.get<ReportJobStatus>(
      `/api/reports/export/${jobId}/status`,
    );
  }
}
