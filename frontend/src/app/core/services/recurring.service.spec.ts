import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  RecurringService,
  RecurringTaskConfig,
  CreateRecurringRequest,
  UpdateRecurringRequest,
} from './recurring.service';

const MOCK_CONFIG: RecurringTaskConfig = {
  id: 'rec-1',
  task_id: 'task-1',
  pattern: 'weekly',
  cron_expression: null,
  interval_days: null,
  next_run_at: '2026-03-01T00:00:00Z',
  last_run_at: null,
  is_active: true,
  max_occurrences: null,
  occurrences_created: 0,
  board_id: 'board-1',
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-02-20T00:00:00Z',
  updated_at: '2026-02-20T00:00:00Z',
  end_date: null,
  skip_weekends: false,
  days_of_week: [],
  day_of_month: null,
  creation_mode: 'on_schedule',
};

describe('RecurringService', () => {
  let service: RecurringService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RecurringService],
    });
    service = TestBed.inject(RecurringService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getConfig()', () => {
    it('should GET /api/tasks/:taskId/recurring', () => {
      service.getConfig('task-1').subscribe((result) => {
        expect(result).toEqual(MOCK_CONFIG);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/recurring');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_CONFIG);
    });
  });

  describe('createConfig()', () => {
    it('should POST /api/tasks/:taskId/recurring with body', () => {
      const createReq: CreateRecurringRequest = {
        pattern: 'daily',
        skip_weekends: true,
      };

      service.createConfig('task-1', createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_CONFIG);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/recurring');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_CONFIG);
    });
  });

  describe('updateConfig()', () => {
    it('should PUT /api/recurring/:id with body', () => {
      const updateReq: UpdateRecurringRequest = {
        pattern: 'monthly',
        is_active: false,
      };

      service.updateConfig('rec-1', updateReq).subscribe((result) => {
        expect(result).toEqual(MOCK_CONFIG);
      });

      const req = httpMock.expectOne('/api/recurring/rec-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_CONFIG);
    });
  });

  describe('deleteConfig()', () => {
    it('should DELETE /api/recurring/:id', () => {
      service.deleteConfig('rec-1').subscribe();

      const req = httpMock.expectOne('/api/recurring/rec-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
