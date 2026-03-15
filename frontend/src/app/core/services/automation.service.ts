import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type AutomationTrigger =
  | 'task_moved'
  | 'task_created'
  | 'task_assigned'
  | 'task_priority_changed'
  | 'task_due_date_passed'
  | 'task_completed'
  | 'subtask_completed'
  | 'comment_added'
  | 'custom_field_changed'
  | 'label_changed'
  | 'due_date_approaching'
  | 'member_joined';

export type AutomationActionType =
  | 'move_task'
  | 'assign_task'
  | 'set_priority'
  | 'send_notification'
  | 'add_label'
  | 'set_milestone'
  | 'create_subtask'
  | 'add_comment'
  | 'set_due_date'
  | 'set_custom_field'
  | 'send_webhook'
  | 'assign_to_role_members';

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
  conditions: Record<string, unknown> | null;
  execution_count: number;
  last_triggered_at: string | null;
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

export type TemplateCategory =
  | 'workflow'
  | 'notifications'
  | 'deadlines'
  | 'labels'
  | 'collaboration'
  | 'integrations'
  | 'custom_fields';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  trigger: AutomationTrigger;
  trigger_config: Record<string, unknown>;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  is_system: boolean;
  enabled: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class AutomationService {
  constructor(private http: HttpClient) {}

  listRules(boardId: string): Observable<AutomationRuleWithActions[]> {
    return this.http.get<AutomationRuleWithActions[]>(
      `/api/projects/${boardId}/automations`,
    );
  }

  createRule(
    boardId: string,
    req: CreateRuleRequest,
  ): Observable<AutomationRuleWithActions> {
    return this.http.post<AutomationRuleWithActions>(
      `/api/projects/${boardId}/automations`,
      req,
    );
  }

  getRule(id: string): Observable<AutomationRuleWithActions> {
    return this.http.get<AutomationRuleWithActions>(`/api/automations/${id}`);
  }

  updateRule(
    id: string,
    req: UpdateRuleRequest,
  ): Observable<AutomationRuleWithActions> {
    return this.http.put<AutomationRuleWithActions>(
      `/api/automations/${id}`,
      req,
    );
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`/api/automations/${id}`);
  }

  getRuleLogs(id: string, limit?: number): Observable<AutomationLog[]> {
    let params = new HttpParams();
    if (limit !== undefined) {
      params = params.set('limit', limit.toString());
    }
    return this.http.get<AutomationLog[]>(`/api/automations/${id}/logs`, {
      params,
    });
  }

  listTemplates(workspaceId: string): Observable<AutomationTemplate[]> {
    return this.http.get<AutomationTemplate[]>(
      `/api/workspaces/${workspaceId}/automation-templates`,
    );
  }

  toggleTemplate(
    workspaceId: string,
    templateId: string,
    enabled: boolean,
  ): Observable<AutomationTemplate> {
    return this.http.patch<AutomationTemplate>(
      `/api/workspaces/${workspaceId}/automation-templates/${templateId}`,
      { enabled },
    );
  }

  applyTemplate(
    workspaceId: string,
    templateId: string,
    boardId: string,
  ): Observable<AutomationRuleWithActions> {
    return this.http.post<AutomationRuleWithActions>(
      `/api/workspaces/${workspaceId}/automation-templates/${templateId}/apply`,
      { board_id: boardId },
    );
  }
}
