import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  EisenhowerService,
  EisenhowerMatrixResponse,
  ResetEisenhowerResponse,
} from './eisenhower.service';

const MOCK_MATRIX: EisenhowerMatrixResponse = {
  do_first: [
    {
      id: 'task-1',
      title: 'Urgent Important',
      description: null,
      priority: 'urgent',
      due_date: '2026-02-21',
      board_id: 'board-1',
      board_name: 'Main',
      column_id: 'col-1',
      column_name: 'To Do',
      position: '1000',
      is_done: false,
      eisenhower_urgency: true,
      eisenhower_importance: true,
      quadrant: 'do_first',
      created_at: '2026-02-20T00:00:00Z',
      updated_at: '2026-02-20T00:00:00Z',
    },
  ],
  schedule: [],
  delegate: [],
  eliminate: [],
};

describe('EisenhowerService', () => {
  let service: EisenhowerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EisenhowerService],
    });
    service = TestBed.inject(EisenhowerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMatrix()', () => {
    it('should GET /api/eisenhower', () => {
      service.getMatrix().subscribe((result) => {
        expect(result).toEqual(MOCK_MATRIX);
      });

      const req = httpMock.expectOne('/api/eisenhower');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_MATRIX);
    });
  });

  describe('updateTaskOverride()', () => {
    it('should PUT /api/eisenhower/tasks/:taskId with urgency and importance', () => {
      service.updateTaskOverride('task-1', true, false).subscribe();

      const req = httpMock.expectOne('/api/eisenhower/tasks/task-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ urgency: true, importance: false });
      req.flush(null);
    });

    it('should send null values to reset to auto-compute', () => {
      service.updateTaskOverride('task-1', null, null).subscribe();

      const req = httpMock.expectOne('/api/eisenhower/tasks/task-1');
      expect(req.request.body).toEqual({ urgency: null, importance: null });
      req.flush(null);
    });
  });

  describe('resetAllOverrides()', () => {
    it('should PUT /api/eisenhower/reset', () => {
      const response: ResetEisenhowerResponse = { tasks_reset: 5 };

      service.resetAllOverrides().subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/eisenhower/reset');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({});
      req.flush(response);
    });
  });
});
