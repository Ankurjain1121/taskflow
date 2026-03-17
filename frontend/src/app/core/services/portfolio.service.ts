import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PortfolioProject {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  background_color: string | null;
  created_at: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  active_tasks: number;
  member_count: number;
  progress_pct: number;
  health: 'on_track' | 'at_risk' | 'behind';
  next_milestone_name: string | null;
  next_milestone_due: string | null;
}

export interface PortfolioMilestone {
  id: string;
  name: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
  project_color: string | null;
  total_tasks: number;
  completed_tasks: number;
}

export interface PortfolioResponse {
  projects: PortfolioProject[];
  milestones: PortfolioMilestone[];
}

@Injectable({
  providedIn: 'root',
})
export class PortfolioService {
  private readonly http = inject(HttpClient);

  getPortfolio(workspaceId: string): Observable<PortfolioResponse> {
    return this.http.get<PortfolioResponse>(
      `/api/workspaces/${workspaceId}/portfolio`,
    );
  }
}
