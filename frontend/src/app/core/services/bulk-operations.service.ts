import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Task } from './task.service';

export interface PreviewResult {
  action: string;
  task_count: number;
  description: string;
  warnings: string[];
}

export interface BulkOperationResult {
  operation_id: string;
  affected_count: number;
  expires_at: string;
}

export interface BulkOperation {
  id: string;
  action_type: string;
  action_config: Record<string, unknown>;
  affected_task_ids: string[];
  task_count: number;
  created_at: string;
  expires_at: string;
}

export interface BulkExecuteRequest {
  action: string;
  task_ids: string[];
  params?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class BulkOperationsService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  previewOperation(
    projectId: string,
    action: string,
    taskIds: string[],
    params?: Record<string, unknown>,
  ): Observable<PreviewResult> {
    return this.http.post<PreviewResult>(
      `${this.apiUrl}/projects/${projectId}/bulk-operations/preview`,
      { action, task_ids: taskIds, params },
    );
  }

  executeOperation(
    projectId: string,
    action: string,
    taskIds: string[],
    params?: Record<string, unknown>,
  ): Observable<BulkOperationResult> {
    return this.http.post<BulkOperationResult>(
      `${this.apiUrl}/projects/${projectId}/bulk-operations/execute`,
      { action, task_ids: taskIds, params },
    );
  }

  undoOperation(opId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/bulk-operations/${opId}/undo`,
      {},
    );
  }

  listOperations(projectId: string): Observable<BulkOperation[]> {
    return this.http.get<BulkOperation[]>(
      `${this.apiUrl}/projects/${projectId}/bulk-operations`,
    );
  }

  exportTasksCsv(tasks: Task[]): void {
    const headers = [
      'Title',
      'Priority',
      'Status',
      'Assignees',
      'Due Date',
      'Labels',
      'Created',
    ];

    const rows = tasks.map((task) => [
      this.escapeCsv(task.title),
      task.priority ?? '',
      task.column_id ?? '',
      (task.assignees ?? []).map((a) => a.display_name).join('; '),
      task.due_date ?? '',
      (task.labels ?? []).map((l) => l.name).join('; '),
      task.created_at ?? '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
