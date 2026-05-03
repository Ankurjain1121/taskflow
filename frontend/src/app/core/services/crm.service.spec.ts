import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  HttpClient,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CrmService, CrmLinksForTask } from './crm.service';

describe('CrmService', () => {
  let service: CrmService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CrmService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllLinksForTask', () => {
    it('should GET /api/tasks/{taskId}/linked-crm-all', () => {
      const mock: CrmLinksForTask = {
        contacts: [{ entity_type: 'contact', entity_id: 'c1', twenty_workspace_id: 'ws1', name: 'Alice' }],
        companies: [],
        deals: [],
      };

      service.getAllLinksForTask('task-1').subscribe((res) => {
        expect(res).toEqual(mock);
      });

      const req = http.expectOne('/api/tasks/task-1/linked-crm-all');
      expect(req.request.method).toBe('GET');
      req.flush(mock);
    });
  });

  describe('linkContactToTask', () => {
    it('should POST /api/tasks/{taskId}/linked-crm-contacts', () => {
      service.linkContactToTask('task-1', 'contact-42', 'ws-9').subscribe();

      const req = http.expectOne('/api/tasks/task-1/linked-crm-contacts');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        contact_id: 'contact-42',
        twenty_workspace_id: 'ws-9',
      });
      req.flush(null);
    });
  });

  describe('linkCompanyToTask', () => {
    it('should POST /api/tasks/{taskId}/linked-crm-companies', () => {
      service.linkCompanyToTask('task-2', 'company-7', 'ws-9').subscribe();

      const req = http.expectOne('/api/tasks/task-2/linked-crm-companies');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        company_id: 'company-7',
        twenty_workspace_id: 'ws-9',
      });
      req.flush(null);
    });
  });

  describe('linkDealToTask', () => {
    it('should POST /api/tasks/{taskId}/linked-crm-deals', () => {
      service.linkDealToTask('task-3', 'deal-5', 'ws-9').subscribe();

      const req = http.expectOne('/api/tasks/task-3/linked-crm-deals');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        deal_id: 'deal-5',
        twenty_workspace_id: 'ws-9',
      });
      req.flush(null);
    });
  });

  describe('unlinkFromTask', () => {
    it('should DELETE for contact type', () => {
      service.unlinkFromTask('task-1', 'contact', 'c1').subscribe();

      const req = http.expectOne('/api/tasks/task-1/linked-crm-contacts/c1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should DELETE for company type', () => {
      service.unlinkFromTask('task-1', 'company', 'co1').subscribe();

      const req = http.expectOne('/api/tasks/task-1/linked-crm-companys/co1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should DELETE for deal type', () => {
      service.unlinkFromTask('task-1', 'deal', 'd1').subscribe();

      const req = http.expectOne('/api/tasks/task-1/linked-crm-deals/d1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('searchEntities', () => {
    it('should GET /api/integrations/twenty/search with params', () => {
      service.searchEntities('Alice').subscribe();

      const req = http.expectOne(
        (r) => r.url === '/api/integrations/twenty/search',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('q')).toBe('Alice');
      expect(req.request.params.get('types')).toBe('contact,company,deal');
      expect(req.request.params.get('limit')).toBe('20');
      req.flush([]);
    });
  });
});
