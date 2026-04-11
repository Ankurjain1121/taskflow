import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** An issue linked to a task (as returned from GET /tasks/:id/linked-issues). */
export interface LinkedIssue {
  id: string;
  project_id: string;
  issue_number: number;
  title: string;
  /** snake_case enum value: open | in_progress | on_hold | closed | reopened */
  status: string;
  /** snake_case enum value: none | minor | major | critical | show_stopper */
  severity: string;
  assignee_name: string | null;
  created_at: string;
  linked_at: string;
}

/** A task linked to an issue (as returned from GET /issues/:id/linked-tasks). */
export interface LinkedTask {
  id: string;
  project_id: string;
  task_number: number | null;
  title: string;
  status_name: string | null;
  status_type: string | null;
  priority: string;
  due_date: string | null;
  linked_at: string;
}

@Injectable({ providedIn: 'root' })
export class TaskIssueLinkService {
  private readonly http = inject(HttpClient);

  listIssuesForTask(taskId: string): Observable<LinkedIssue[]> {
    return this.http.get<LinkedIssue[]>(`/api/tasks/${taskId}/linked-issues`);
  }

  linkIssue(taskId: string, issueId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `/api/tasks/${taskId}/linked-issues`,
      { issue_id: issueId },
    );
  }

  unlinkIssue(taskId: string, issueId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `/api/tasks/${taskId}/linked-issues/${issueId}`,
    );
  }

  listTasksForIssue(issueId: string): Observable<LinkedTask[]> {
    return this.http.get<LinkedTask[]>(`/api/issues/${issueId}/linked-tasks`);
  }
}
