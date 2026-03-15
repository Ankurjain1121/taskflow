import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  is_running: boolean;
  is_billable: boolean;
  board_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryWithTask extends TimeEntry {
  task_title: string;
  is_billable: boolean;
}

export interface TaskTimeReport {
  task_id: string;
  task_title: string;
  total_minutes: number;
  entries_count: number;
}

export interface CreateManualEntry {
  description?: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  is_billable?: boolean;
}

export interface TimesheetEntry {
  id: string;
  task_id: string;
  task_title: string;
  user_id: string;
  user_name: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  is_billable: boolean;
  is_running: boolean;
  billing_rate_cents: number | null;
}

export interface TimesheetSummary {
  total_minutes: number;
  billable_minutes: number;
  non_billable_minutes: number;
  total_cost_cents: number;
}

export interface TimesheetReport {
  entries: TimesheetEntry[];
  summary: TimesheetSummary;
}

@Injectable({
  providedIn: 'root',
})
export class TimeTrackingService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  listEntries(taskId: string): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(
      `${this.apiUrl}/tasks/${taskId}/time-entries`,
    );
  }

  startTimer(taskId: string, description?: string): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(
      `${this.apiUrl}/tasks/${taskId}/time-entries/start`,
      { description: description || null },
    );
  }

  stopTimer(entryId: string): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(
      `${this.apiUrl}/time-entries/${entryId}/stop`,
      {},
    );
  }

  createManualEntry(
    taskId: string,
    entry: CreateManualEntry,
  ): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(
      `${this.apiUrl}/tasks/${taskId}/time-entries`,
      entry,
    );
  }

  updateEntry(
    id: string,
    data: Partial<{
      description: string;
      started_at: string;
      ended_at: string;
      duration_minutes: number;
    }>,
  ): Observable<TimeEntry> {
    return this.http.put<TimeEntry>(`${this.apiUrl}/time-entries/${id}`, data);
  }

  deleteEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/time-entries/${id}`);
  }

  getBoardTimeReport(boardId: string): Observable<TaskTimeReport[]> {
    return this.http.get<TaskTimeReport[]>(
      `${this.apiUrl}/boards/${boardId}/time-report`,
    );
  }

  getRunningTimer(): Observable<TimeEntryWithTask | null> {
    return this.http.get<TimeEntryWithTask | null>(
      `${this.apiUrl}/time-entries/running`,
    );
  }

  getTimesheetReport(
    projectId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      user_id?: string;
      billable_only?: boolean;
    },
  ): Observable<TimesheetReport> {
    return this.http.get<TimesheetReport>(
      `${this.apiUrl}/projects/${projectId}/timesheet-report`,
      { params: params as any },
    );
  }
}
