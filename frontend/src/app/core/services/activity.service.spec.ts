import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ActivityService,
  ActivityLogEntry,
  ActivityListResponse,
} from './activity.service';

const MOCK_ACTIVITY: ActivityLogEntry = {
  id: 'act-1',
  action: 'created',
  entity_type: 'task',
  entity_id: 'task-1',
  user_id: 'user-1',
  metadata: { title: 'New Task' },
  tenant_id: 'tenant-1',
  created_at: '2026-01-01T00:00:00Z',
  actor: {
    id: 'user-1',
    display_name: 'Test User',
    avatar_url: null,
  },
};

const MOCK_RESPONSE: ActivityListResponse = {
  items: [MOCK_ACTIVITY],
  nextCursor: null,
};

describe('ActivityService', () => {
  let service: ActivityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ActivityService],
    });
    service = TestBed.inject(ActivityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listByTask()', () => {
    it('should GET /api/tasks/:taskId/activity with no params', () => {
      service.listByTask('task-1').subscribe((result) => {
        expect(result).toEqual(MOCK_RESPONSE);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/activity');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_RESPONSE);
    });

    it('should pass cursor param when provided', () => {
      service.listByTask('task-1', 'cursor-abc').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/tasks/task-1/activity' &&
          r.params.get('cursor') === 'cursor-abc'
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_RESPONSE);
    });

    it('should pass limit param when provided', () => {
      service.listByTask('task-1', undefined, 10).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/tasks/task-1/activity' &&
          r.params.get('limit') === '10'
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_RESPONSE);
    });

    it('should pass both cursor and limit when provided', () => {
      service.listByTask('task-1', 'cursor-xyz', 5).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/tasks/task-1/activity' &&
          r.params.get('cursor') === 'cursor-xyz' &&
          r.params.get('limit') === '5'
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_RESPONSE);
    });

    it('should handle response with nextCursor for pagination', () => {
      const paginatedResponse: ActivityListResponse = {
        items: [MOCK_ACTIVITY],
        nextCursor: 'next-page-cursor',
      };

      service.listByTask('task-1').subscribe((result) => {
        expect(result.nextCursor).toBe('next-page-cursor');
        expect(result.items.length).toBe(1);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/activity');
      req.flush(paginatedResponse);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on listByTask', () => {
      let error: any;
      service.listByTask('task-bad').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-bad/activity');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });
  });
});
