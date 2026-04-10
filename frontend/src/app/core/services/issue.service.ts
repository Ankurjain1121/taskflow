import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  CreateIssueRequest,
  Issue,
  IssueFilters,
  IssueSummary,
  ResolveIssueRequest,
  UpdateIssueRequest,
} from '../../shared/types/issue.types';

@Injectable({ providedIn: 'root' })
export class IssueService {
  private http = inject(HttpClient);

  list(projectId: string, filters: IssueFilters = {}): Observable<Issue[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return this.http.get<Issue[]>(`/api/projects/${projectId}/issues`, { params });
  }

  summary(projectId: string): Observable<IssueSummary> {
    return this.http.get<IssueSummary>(`/api/projects/${projectId}/issues/summary`);
  }

  get(id: string): Observable<Issue> {
    return this.http.get<Issue>(`/api/issues/${id}`);
  }

  create(projectId: string, req: CreateIssueRequest): Observable<Issue> {
    return this.http.post<Issue>(`/api/projects/${projectId}/issues`, req);
  }

  update(id: string, req: UpdateIssueRequest): Observable<Issue> {
    return this.http.put<Issue>(`/api/issues/${id}`, req);
  }

  resolve(id: string, req: ResolveIssueRequest): Observable<Issue> {
    return this.http.post<Issue>(`/api/issues/${id}/resolve`, req);
  }

  reopen(id: string): Observable<Issue> {
    return this.http.post<Issue>(`/api/issues/${id}/reopen`, {});
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/issues/${id}`);
  }
}
