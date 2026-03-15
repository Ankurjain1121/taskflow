import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ReportsService, BoardReport } from './reports.service';

const MOCK_REPORT: BoardReport = {
  completion_rate: { total: 20, completed: 8, remaining: 12 },
  burndown: [
    { date: '2026-02-15', remaining: 20 },
    { date: '2026-02-20', remaining: 12 },
  ],
  priority_distribution: [
    { priority: 'high', count: 5 },
    { priority: 'medium', count: 10 },
  ],
  assignee_workload: [
    {
      user_id: 'user-1',
      name: 'Alice',
      avatar_url: null,
      total_tasks: 8,
      completed_tasks: 3,
    },
  ],
  overdue_analysis: [
    { bucket: '1-3 days', count: 2 },
    { bucket: '4-7 days', count: 1 },
  ],
};

describe('ReportsService', () => {
  let service: ReportsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReportsService],
    });
    service = TestBed.inject(ReportsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getBoardReport()', () => {
    it('should GET /api/projects/:boardId/reports with default days=30', () => {
      service.getBoardReport('board-1').subscribe((result) => {
        expect(result).toEqual(MOCK_REPORT);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/projects/board-1/reports',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('days')).toBe('30');
      req.flush(MOCK_REPORT);
    });

    it('should pass custom days parameter', () => {
      service.getBoardReport('board-1', 7).subscribe((result) => {
        expect(result).toEqual(MOCK_REPORT);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/projects/board-1/reports',
      );
      expect(req.request.params.get('days')).toBe('7');
      req.flush(MOCK_REPORT);
    });
  });
});
