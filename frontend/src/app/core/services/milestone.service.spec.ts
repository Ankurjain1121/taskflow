import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  MilestoneService,
  Milestone,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
} from './milestone.service';

const MOCK_MILESTONE: Milestone = {
  id: 'ms-1',
  name: 'Sprint 1',
  description: 'First sprint',
  due_date: '2026-03-01',
  color: '#3b82f6',
  board_id: 'board-1',
  total_tasks: 10,
  completed_tasks: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('MilestoneService', () => {
  let service: MilestoneService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MilestoneService],
    });
    service = TestBed.inject(MilestoneService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list()', () => {
    it('should GET /api/boards/:boardId/milestones', () => {
      const milestones = [MOCK_MILESTONE];

      service.list('board-1').subscribe((result) => {
        expect(result).toEqual(milestones);
      });

      const req = httpMock.expectOne('/api/boards/board-1/milestones');
      expect(req.request.method).toBe('GET');
      req.flush(milestones);
    });
  });

  describe('get()', () => {
    it('should GET /api/milestones/:id', () => {
      service.get('ms-1').subscribe((result) => {
        expect(result).toEqual(MOCK_MILESTONE);
      });

      const req = httpMock.expectOne('/api/milestones/ms-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_MILESTONE);
    });
  });

  describe('create()', () => {
    it('should POST /api/boards/:boardId/milestones with body', () => {
      const createReq: CreateMilestoneRequest = {
        name: 'Sprint 2',
        description: 'Second sprint',
        due_date: '2026-04-01',
        color: '#22c55e',
      };

      service.create('board-1', createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_MILESTONE);
      });

      const req = httpMock.expectOne('/api/boards/board-1/milestones');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_MILESTONE);
    });
  });

  describe('update()', () => {
    it('should PUT /api/milestones/:id with body', () => {
      const updateReq: UpdateMilestoneRequest = { name: 'Sprint 1 Updated' };

      service.update('ms-1', updateReq).subscribe((result) => {
        expect(result).toEqual(MOCK_MILESTONE);
      });

      const req = httpMock.expectOne('/api/milestones/ms-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_MILESTONE);
    });
  });

  describe('delete()', () => {
    it('should DELETE /api/milestones/:id', () => {
      service.delete('ms-1').subscribe();

      const req = httpMock.expectOne('/api/milestones/ms-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('assignTask()', () => {
    it('should POST /api/tasks/:taskId/milestone with milestone_id', () => {
      service.assignTask('task-1', 'ms-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/milestone');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ milestone_id: 'ms-1' });
      req.flush(null);
    });
  });

  describe('unassignTask()', () => {
    it('should DELETE /api/tasks/:taskId/milestone', () => {
      service.unassignTask('task-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/milestone');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
