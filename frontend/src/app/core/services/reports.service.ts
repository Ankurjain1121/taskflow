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

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  constructor(private http: HttpClient) {}

  getBoardReport(boardId: string, days: number = 30): Observable<BoardReport> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<BoardReport>(`/api/projects/${boardId}/reports`, {
      params,
    });
  }
}
