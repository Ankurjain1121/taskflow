import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  MyTasksService,
  MyTasksResponse,
  MyTasksSummary,
  MyTask,
} from './my-tasks.service';

const MOCK_MY_TASK: MyTask = {
  id: 'task-1',
  title: 'My Task',
  description: 'A task assigned to me',
  priority: 'medium',
  due_date: '2026-03-01',
  column_id: 'col-1',
  column_name: 'To Do',
  column_status_mapping: null,
  project_id: 'board-1',
  project_name: 'Test Project',
  workspace_id: 'ws-1',
  workspace_name: 'Test Workspace',
  labels: [],
  assignees: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_RESPONSE: MyTasksResponse = {
  items: [MOCK_MY_TASK],
  next_cursor: null,
};

const MOCK_SUMMARY: MyTasksSummary = {
  total_assigned: 10,
  due_soon: 3,
  overdue: 1,
  completed_this_week: 5,
};

describe('MyTasksService', () => {
  let service: MyTasksService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MyTasksService],
    });
    service = TestBed.inject(MyTasksService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getMyTasks()', () => {
    it('should GET /api/my-tasks with no params when called with defaults', () => {
      service.getMyTasks().subscribe((result) => {
        expect(result).toEqual(MOCK_RESPONSE);
      });

      const req = httpMock.expectOne('/api/my-tasks');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush(MOCK_RESPONSE);
    });

    it('should set sort_by param when provided', () => {
      service.getMyTasks({ sort_by: 'due_date' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      expect(req.request.params.get('sort_by')).toBe('due_date');
      expect(req.request.params.keys().length).toBe(1);
      req.flush(MOCK_RESPONSE);
    });

    it('should set sort_order param when provided', () => {
      service.getMyTasks({ sort_order: 'desc' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      expect(req.request.params.get('sort_order')).toBe('desc');
      req.flush(MOCK_RESPONSE);
    });

    it('should set project_id param when provided', () => {
      service.getMyTasks({ project_id: 'board-42' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      expect(req.request.params.get('project_id')).toBe('board-42');
      req.flush(MOCK_RESPONSE);
    });

    it('should set cursor param when provided', () => {
      service.getMyTasks({ cursor: 'abc123' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      expect(req.request.params.get('cursor')).toBe('abc123');
      req.flush(MOCK_RESPONSE);
    });

    it('should set limit param as string when provided', () => {
      service.getMyTasks({ limit: 25 }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      expect(req.request.params.get('limit')).toBe('25');
      req.flush(MOCK_RESPONSE);
    });

    it('should set all params when all are provided', () => {
      service
        .getMyTasks({
          sort_by: 'priority',
          sort_order: 'asc',
          project_id: 'board-1',
          cursor: 'cursor-xyz',
          limit: 50,
        })
        .subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      expect(req.request.params.get('sort_by')).toBe('priority');
      expect(req.request.params.get('sort_order')).toBe('asc');
      expect(req.request.params.get('project_id')).toBe('board-1');
      expect(req.request.params.get('cursor')).toBe('cursor-xyz');
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.keys().length).toBe(5);
      req.flush(MOCK_RESPONSE);
    });

    it('should not set params for undefined values', () => {
      service
        .getMyTasks({ sort_by: 'created_at', project_id: undefined })
        .subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      expect(req.request.params.get('sort_by')).toBe('created_at');
      expect(req.request.params.has('project_id')).toBe(false);
      expect(req.request.params.keys().length).toBe(1);
      req.flush(MOCK_RESPONSE);
    });

    it('should return response with next_cursor for pagination', () => {
      const paginatedResponse: MyTasksResponse = {
        items: [MOCK_MY_TASK],
        next_cursor: 'next-page-cursor',
      };

      service.getMyTasks({ limit: 1 }).subscribe((result) => {
        expect(result.items).toHaveLength(1);
        expect(result.next_cursor).toBe('next-page-cursor');
      });

      const req = httpMock.expectOne((r) => r.url === '/api/my-tasks');
      req.flush(paginatedResponse);
    });
  });

  describe('getMyTasksSummary()', () => {
    it('should GET /api/my-tasks/summary', () => {
      service.getMyTasksSummary().subscribe((result) => {
        expect(result).toEqual(MOCK_SUMMARY);
      });

      const req = httpMock.expectOne('/api/my-tasks/summary');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_SUMMARY);
    });

    it('should return all summary fields', () => {
      service.getMyTasksSummary().subscribe((result) => {
        expect(result.total_assigned).toBe(10);
        expect(result.due_soon).toBe(3);
        expect(result.overdue).toBe(1);
        expect(result.completed_this_week).toBe(5);
      });

      const req = httpMock.expectOne('/api/my-tasks/summary');
      req.flush(MOCK_SUMMARY);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on getMyTasks', () => {
      let error: any;
      service.getMyTasks().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/my-tasks');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(401);
    });

    it('should propagate HTTP errors on getMyTasksSummary', () => {
      let error: any;
      service.getMyTasksSummary().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/my-tasks/summary');
      req.flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      expect(error).toBeTruthy();
      expect(error.status).toBe(500);
    });
  });
});
