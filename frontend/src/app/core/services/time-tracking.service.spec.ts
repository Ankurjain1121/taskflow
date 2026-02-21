import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  TimeTrackingService,
  TimeEntry,
  TimeEntryWithTask,
  TaskTimeReport,
  CreateManualEntry,
} from './time-tracking.service';

const MOCK_ENTRY: TimeEntry = {
  id: 'te-1',
  task_id: 'task-1',
  user_id: 'user-1',
  description: 'Working on feature',
  started_at: '2026-02-20T09:00:00Z',
  ended_at: '2026-02-20T10:30:00Z',
  duration_minutes: 90,
  is_running: false,
  board_id: 'board-1',
  tenant_id: 'tenant-1',
  created_at: '2026-02-20T09:00:00Z',
  updated_at: '2026-02-20T10:30:00Z',
};

describe('TimeTrackingService', () => {
  let service: TimeTrackingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TimeTrackingService],
    });
    service = TestBed.inject(TimeTrackingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listEntries()', () => {
    it('should GET /api/tasks/:taskId/time-entries', () => {
      const entries = [MOCK_ENTRY];

      service.listEntries('task-1').subscribe((result) => {
        expect(result).toEqual(entries);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/time-entries');
      expect(req.request.method).toBe('GET');
      req.flush(entries);
    });
  });

  describe('startTimer()', () => {
    it('should POST /api/tasks/:taskId/time-entries/start with description', () => {
      service.startTimer('task-1', 'Working').subscribe((result) => {
        expect(result).toEqual(MOCK_ENTRY);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/time-entries/start');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ description: 'Working' });
      req.flush(MOCK_ENTRY);
    });

    it('should send null description when not provided', () => {
      service.startTimer('task-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/time-entries/start');
      expect(req.request.body).toEqual({ description: null });
      req.flush(MOCK_ENTRY);
    });
  });

  describe('stopTimer()', () => {
    it('should POST /api/time-entries/:entryId/stop', () => {
      service.stopTimer('te-1').subscribe((result) => {
        expect(result).toEqual(MOCK_ENTRY);
      });

      const req = httpMock.expectOne('/api/time-entries/te-1/stop');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(MOCK_ENTRY);
    });
  });

  describe('createManualEntry()', () => {
    it('should POST /api/tasks/:taskId/time-entries with manual entry', () => {
      const manualEntry: CreateManualEntry = {
        description: 'Manual entry',
        started_at: '2026-02-20T09:00:00Z',
        ended_at: '2026-02-20T10:00:00Z',
        duration_minutes: 60,
      };

      service.createManualEntry('task-1', manualEntry).subscribe((result) => {
        expect(result).toEqual(MOCK_ENTRY);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/time-entries');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(manualEntry);
      req.flush(MOCK_ENTRY);
    });
  });

  describe('updateEntry()', () => {
    it('should PUT /api/time-entries/:id with data', () => {
      const updateData = { description: 'Updated desc' };

      service.updateEntry('te-1', updateData).subscribe((result) => {
        expect(result).toEqual(MOCK_ENTRY);
      });

      const req = httpMock.expectOne('/api/time-entries/te-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateData);
      req.flush(MOCK_ENTRY);
    });
  });

  describe('deleteEntry()', () => {
    it('should DELETE /api/time-entries/:id', () => {
      service.deleteEntry('te-1').subscribe();

      const req = httpMock.expectOne('/api/time-entries/te-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getBoardTimeReport()', () => {
    it('should GET /api/boards/:boardId/time-report', () => {
      const report: TaskTimeReport[] = [
        { task_id: 'task-1', task_title: 'Task 1', total_minutes: 120, entries_count: 3 },
      ];

      service.getBoardTimeReport('board-1').subscribe((result) => {
        expect(result).toEqual(report);
      });

      const req = httpMock.expectOne('/api/boards/board-1/time-report');
      expect(req.request.method).toBe('GET');
      req.flush(report);
    });
  });

  describe('getRunningTimer()', () => {
    it('should GET /api/time-entries/running', () => {
      const running: TimeEntryWithTask = {
        ...MOCK_ENTRY,
        is_running: true,
        ended_at: null,
        duration_minutes: null,
        task_title: 'Active Task',
      };

      service.getRunningTimer().subscribe((result) => {
        expect(result).toEqual(running);
      });

      const req = httpMock.expectOne('/api/time-entries/running');
      expect(req.request.method).toBe('GET');
      req.flush(running);
    });
  });
});
