import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  SubtaskService,
  Subtask,
  SubtaskWithAssignee,
  SubtaskListResponse,
} from './subtask.service';

const MOCK_SUBTASK: Subtask = {
  id: 'sub-1',
  title: 'Write tests',
  is_completed: false,
  position: '1000',
  task_id: 'task-1',
  assigned_to_id: null,
  due_date: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_SUBTASK_WITH_ASSIGNEE: SubtaskWithAssignee = {
  ...MOCK_SUBTASK,
  assignee_name: null,
  assignee_avatar_url: null,
};

const MOCK_LIST_RESPONSE: SubtaskListResponse = {
  subtasks: [MOCK_SUBTASK_WITH_ASSIGNEE],
  progress: { completed: 0, total: 1 },
};

describe('SubtaskService', () => {
  let service: SubtaskService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SubtaskService],
    });
    service = TestBed.inject(SubtaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('list()', () => {
    it('should GET /api/tasks/:taskId/subtasks', () => {
      service.list('task-1').subscribe((result) => {
        expect(result).toEqual(MOCK_LIST_RESPONSE);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/subtasks');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_LIST_RESPONSE);
    });
  });

  describe('create()', () => {
    it('should POST /api/tasks/:taskId/subtasks with title', () => {
      service.create('task-1', 'Write tests').subscribe((result) => {
        expect(result).toEqual(MOCK_SUBTASK);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/subtasks');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ title: 'Write tests' });
      req.flush(MOCK_SUBTASK);
    });
  });

  describe('update()', () => {
    it('should PUT /api/subtasks/:subtaskId with request body', () => {
      service.update('sub-1', { title: 'Updated title' }).subscribe((result) => {
        expect(result).toEqual(MOCK_SUBTASK);
      });

      const req = httpMock.expectOne('/api/subtasks/sub-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ title: 'Updated title' });
      req.flush(MOCK_SUBTASK);
    });
  });

  describe('toggle()', () => {
    it('should PATCH /api/subtasks/:subtaskId/toggle', () => {
      const toggledSubtask = {
        ...MOCK_SUBTASK,
        is_completed: true,
        completed_at: '2026-01-02T00:00:00Z',
      };

      service.toggle('sub-1').subscribe((result) => {
        expect(result).toEqual(toggledSubtask);
      });

      const req = httpMock.expectOne('/api/subtasks/sub-1/toggle');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush(toggledSubtask);
    });
  });

  describe('reorder()', () => {
    it('should PUT /api/subtasks/:subtaskId/reorder with position', () => {
      service.reorder('sub-1', '2000').subscribe((result) => {
        expect(result).toEqual(MOCK_SUBTASK);
      });

      const req = httpMock.expectOne('/api/subtasks/sub-1/reorder');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ position: '2000' });
      req.flush(MOCK_SUBTASK);
    });
  });

  describe('delete()', () => {
    it('should DELETE /api/subtasks/:subtaskId', () => {
      service.delete('sub-1').subscribe();

      const req = httpMock.expectOne('/api/subtasks/sub-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on create', () => {
      let error: any;
      service.create('task-1', '').subscribe({
        error: (e: any) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-1/subtasks');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });
  });
});
