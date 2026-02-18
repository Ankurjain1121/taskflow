import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type AutomationTrigger =
  | 'task_moved'
  | 'task_created'
  | 'task_assigned'
  | 'task_priority_changed'
  | 'task_due_date_passed'
  | 'task_completed';

export type AutomationActionType =
  | 'move_task'
  | 'assign_task'
  | 'set_priority'
  | 'send_notification'
  | 'add_label'
  | 'set_milestone';

export interface AutomationRule {
  id: string;
  name: string;
  board_id: string;
  trigger: AutomationTrigger;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationAction {
  id: string;
  rule_id: string;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  position: number;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  task_id: string | null;
  triggered_at: string;
  status: string;
  details: Record<string, unknown> | null;
}

export interface AutomationRuleWithActions {
  rule: AutomationRule;
  actions: AutomationAction[];
}

export interface CreateActionRequest {
  action_type: AutomationActionType;
  action_config?: Record<string, unknown>;
}

export interface CreateRuleRequest {
  name: string;
  trigger: AutomationTrigger;
  trigger_config?: Record<string, unknown>;
  actions: CreateActionRequest[];
}

export interface UpdateRuleRequest {
  name?: string;
  trigger?: AutomationTrigger;
  trigger_config?: Record<string, unknown>;
  is_active?: boolean;
  actions?: CreateActionRequest[];
}

@Injectable({ providedIn: 'root' })
export class AutomationService {
  constructor(private http: HttpClient) {}

  listRules(boardId: string): Observable<AutomationRuleWithActions[]> {
    return this.http.get<AutomationRuleWithActions[]>(`/api/boards/${boardId}/automations`);
  }

  createRule(boardId: string, req: CreateRuleRequest): Observable<AutomationRuleWithActions> {
    return this.http.post<AutomationRuleWithActions>(`/api/boards/${boardId}/automations`, req);
  }

  getRule(id: string): Observable<AutomationRuleWithActions> {
    return this.http.get<AutomationRuleWithActions>(`/api/automations/${id}`);
  }

  updateRule(id: string, req: UpdateRuleRequest): Observable<AutomationRuleWithActions> {
    return this.http.put<AutomationRuleWithActions>(`/api/automations/${id}`, req);
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`/api/automations/${id}`);
  }

  getRuleLogs(id: string, limit?: number): Observable<AutomationLog[]> {
    let params = new HttpParams();
    if (limit !== undefined) {
      params = params.set('limit', limit.toString());
    }
    return this.http.get<AutomationLog[]>(`/api/automations/${id}/logs`, { params });
  }
}
