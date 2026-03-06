import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ImportResult {
  imported_count: number;
}

export interface TrelloImportResult {
  imported_count: number;
  columns_created: number;
  skipped: number;
}

export interface ImportTaskItem {
  title: string;
  description?: string;
  priority?: string;
  column_name?: string;
  due_date?: string;
}

export interface ExportBoardJson {
  board: {
    id: string;
    name: string;
    description: string | null;
    exported_at: string;
  };
  columns: {
    id: string;
    name: string;
    position: string;
    color: string | null;
  }[];
  tasks: {
    title: string;
    description: string | null;
    priority: string;
    column_name: string;
    due_date: string | null;
    assignees: string[];
    created_at: string;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class ImportExportService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  exportCsv(projectId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/projects/${projectId}/export`, {
      params: { format: 'csv' },
      responseType: 'blob',
    });
  }

  exportJson(projectId: string): Observable<ExportBoardJson> {
    return this.http.get<ExportBoardJson>(
      `${this.apiUrl}/projects/${projectId}/export`,
      { params: { format: 'json' } },
    );
  }

  importJson(
    projectId: string,
    tasks: ImportTaskItem[],
  ): Observable<ImportResult> {
    return this.http.post<ImportResult>(
      `${this.apiUrl}/projects/${projectId}/import`,
      tasks,
    );
  }

  importCsv(projectId: string, csvText: string): Observable<ImportResult> {
    return this.http.post<ImportResult>(
      `${this.apiUrl}/projects/${projectId}/import/csv`,
      { csv_text: csvText },
    );
  }

  importTrello(
    projectId: string,
    trelloData: unknown,
  ): Observable<TrelloImportResult> {
    return this.http.post<TrelloImportResult>(
      `${this.apiUrl}/projects/${projectId}/import/trello`,
      trelloData,
    );
  }
}
