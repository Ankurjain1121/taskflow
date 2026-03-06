import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type RecurrencePattern =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'custom'
  | 'yearly'
  | 'weekdays'
  | 'custom_weekly';

export type CreationMode = 'on_schedule' | 'on_completion';

export interface RecurringTaskConfig {
  id: string;
  task_id: string;
  pattern: RecurrencePattern;
  cron_expression: string | null;
  interval_days: number | null;
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
  max_occurrences: number | null;
  occurrences_created: number;
  board_id: string;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  end_date: string | null;
  skip_weekends: boolean;
  days_of_week: number[];
  day_of_month: number | null;
  creation_mode: CreationMode;
}

export interface CreateRecurringRequest {
  pattern: RecurrencePattern;
  cron_expression?: string;
  interval_days?: number;
  max_occurrences?: number;
  end_date?: string;
  skip_weekends?: boolean;
  days_of_week?: number[];
  day_of_month?: number;
  creation_mode?: CreationMode;
  position_id?: string;
}

export interface UpdateRecurringRequest {
  pattern?: RecurrencePattern;
  cron_expression?: string;
  interval_days?: number;
  max_occurrences?: number;
  is_active?: boolean;
  end_date?: string;
  skip_weekends?: boolean;
  days_of_week?: number[];
  day_of_month?: number;
  creation_mode?: CreationMode;
  position_id?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RecurringService {
  constructor(private http: HttpClient) {}

  getConfig(taskId: string): Observable<RecurringTaskConfig> {
    return this.http.get<RecurringTaskConfig>(`/api/tasks/${taskId}/recurring`);
  }

  createConfig(
    taskId: string,
    req: CreateRecurringRequest,
  ): Observable<RecurringTaskConfig> {
    return this.http.post<RecurringTaskConfig>(
      `/api/tasks/${taskId}/recurring`,
      req,
    );
  }

  updateConfig(
    id: string,
    req: UpdateRecurringRequest,
  ): Observable<RecurringTaskConfig> {
    return this.http.put<RecurringTaskConfig>(`/api/recurring/${id}`, req);
  }

  deleteConfig(id: string): Observable<void> {
    return this.http.delete<void>(`/api/recurring/${id}`);
  }
}
