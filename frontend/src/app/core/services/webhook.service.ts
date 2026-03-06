import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Webhook {
  id: string;
  project_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string;
  success: boolean;
}

export interface CreateWebhookRequest {
  url: string;
  secret?: string;
  events: string[];
}

export interface UpdateWebhookRequest {
  url?: string;
  secret?: string;
  events?: string[];
  is_active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
  constructor(private http: HttpClient) {}

  listWebhooks(projectId: string): Observable<Webhook[]> {
    return this.http.get<Webhook[]>(`/api/projects/${projectId}/webhooks`);
  }

  createWebhook(
    projectId: string,
    req: CreateWebhookRequest,
  ): Observable<Webhook> {
    return this.http.post<Webhook>(`/api/projects/${projectId}/webhooks`, req);
  }

  updateWebhook(id: string, req: UpdateWebhookRequest): Observable<Webhook> {
    return this.http.put<Webhook>(`/api/webhooks/${id}`, req);
  }

  deleteWebhook(id: string): Observable<void> {
    return this.http.delete<void>(`/api/webhooks/${id}`);
  }

  getDeliveries(webhookId: string, limit = 20): Observable<WebhookDelivery[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<WebhookDelivery[]>(
      `/api/webhooks/${webhookId}/deliveries`,
      { params },
    );
  }
}
