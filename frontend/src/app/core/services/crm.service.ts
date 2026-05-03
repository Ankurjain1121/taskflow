import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';

export type CrmEntityType = 'contact' | 'company' | 'deal';

export interface CrmLinkedEntity {
  entity_type: CrmEntityType;
  entity_id: string;
  twenty_workspace_id: string;
  name: string;
  stage?: string | null;
}

export interface CrmLinksForTask {
  contacts: CrmLinkedEntity[];
  companies: CrmLinkedEntity[];
  deals: CrmLinkedEntity[];
  failed_count?: number;
  cached_at?: string | null;
}

export interface CrmSearchResult {
  entity_type: CrmEntityType;
  entity_id: string;
  twenty_workspace_id: string;
  name: string;
  stage?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private http = inject(HttpClient);

  getAllLinksForTask(taskId: string): Observable<CrmLinksForTask> {
    return this.http
      .get<CrmLinksForTask>(`/api/tasks/${taskId}/linked-crm-all`)
      .pipe(share());
  }

  linkContactToTask(
    taskId: string,
    contactId: string,
    workspaceId: string,
  ): Observable<void> {
    return this.http.post<void>(`/api/tasks/${taskId}/linked-crm-contacts`, {
      contact_id: contactId,
      twenty_workspace_id: workspaceId,
    });
  }

  linkCompanyToTask(
    taskId: string,
    companyId: string,
    workspaceId: string,
  ): Observable<void> {
    return this.http.post<void>(`/api/tasks/${taskId}/linked-crm-companies`, {
      company_id: companyId,
      twenty_workspace_id: workspaceId,
    });
  }

  linkDealToTask(
    taskId: string,
    dealId: string,
    workspaceId: string,
  ): Observable<void> {
    return this.http.post<void>(`/api/tasks/${taskId}/linked-crm-deals`, {
      deal_id: dealId,
      twenty_workspace_id: workspaceId,
    });
  }

  unlinkFromTask(
    taskId: string,
    type: CrmEntityType,
    entityId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `/api/tasks/${taskId}/linked-crm-${type}s/${entityId}`,
    );
  }

  searchEntities(query: string): Observable<CrmSearchResult[]> {
    const params = { q: query, types: 'contact,company,deal', limit: '20' };
    return this.http
      .get<CrmSearchResult[]>('/api/integrations/twenty/search', { params })
      .pipe(share());
  }
}
