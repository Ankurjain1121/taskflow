import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  WebhookService,
  Webhook,
  WebhookDelivery,
  CreateWebhookRequest,
  UpdateWebhookRequest,
} from './webhook.service';

const MOCK_WEBHOOK: Webhook = {
  id: 'wh-1',
  project_id: 'board-1',
  url: 'https://example.com/webhook',
  events: ['task.created', 'task.updated'],
  is_active: true,
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-02-20T00:00:00Z',
  updated_at: '2026-02-20T00:00:00Z',
};

const MOCK_DELIVERY: WebhookDelivery = {
  id: 'del-1',
  webhook_id: 'wh-1',
  event_type: 'task.created',
  payload: { task_id: 'task-1' },
  response_status: 200,
  response_body: '{"ok":true}',
  delivered_at: '2026-02-20T10:00:00Z',
  success: true,
};

describe('WebhookService', () => {
  let service: WebhookService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WebhookService],
    });
    service = TestBed.inject(WebhookService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listWebhooks()', () => {
    it('should GET /api/projects/:projectId/webhooks', () => {
      const webhooks = [MOCK_WEBHOOK];

      service.listWebhooks('board-1').subscribe((result) => {
        expect(result).toEqual(webhooks);
      });

      const req = httpMock.expectOne('/api/projects/board-1/webhooks');
      expect(req.request.method).toBe('GET');
      req.flush(webhooks);
    });
  });

  describe('createWebhook()', () => {
    it('should POST /api/projects/:projectId/webhooks with body', () => {
      const createReq: CreateWebhookRequest = {
        url: 'https://example.com/hook',
        events: ['task.created'],
      };

      service.createWebhook('board-1', createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_WEBHOOK);
      });

      const req = httpMock.expectOne('/api/projects/board-1/webhooks');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_WEBHOOK);
    });
  });

  describe('updateWebhook()', () => {
    it('should PUT /api/webhooks/:id with body', () => {
      const updateReq: UpdateWebhookRequest = {
        is_active: false,
      };

      service.updateWebhook('wh-1', updateReq).subscribe((result) => {
        expect(result).toEqual(MOCK_WEBHOOK);
      });

      const req = httpMock.expectOne('/api/webhooks/wh-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_WEBHOOK);
    });
  });

  describe('deleteWebhook()', () => {
    it('should DELETE /api/webhooks/:id', () => {
      service.deleteWebhook('wh-1').subscribe();

      const req = httpMock.expectOne('/api/webhooks/wh-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getDeliveries()', () => {
    it('should GET /api/webhooks/:webhookId/deliveries with default limit', () => {
      const deliveries = [MOCK_DELIVERY];

      service.getDeliveries('wh-1').subscribe((result) => {
        expect(result).toEqual(deliveries);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/webhooks/wh-1/deliveries',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('20');
      req.flush(deliveries);
    });

    it('should pass custom limit parameter', () => {
      service.getDeliveries('wh-1', 50).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/webhooks/wh-1/deliveries',
      );
      expect(req.request.params.get('limit')).toBe('50');
      req.flush([]);
    });
  });
});
