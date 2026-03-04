import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SearchService, SearchResults } from './search.service';

const MOCK_SEARCH_RESULTS: SearchResults = {
  tasks: [
    {
      id: 'task-1',
      title: 'Test Task',
      description: 'A test task',
      board_id: 'board-1',
      board_name: 'Test Board',
      workspace_id: 'ws-1',
      workspace_name: 'Test Workspace',
    },
  ],
  boards: [
    {
      id: 'board-1',
      name: 'Test Board',
      description: 'A test board',
      workspace_id: 'ws-1',
      workspace_name: 'Test Workspace',
    },
  ],
  comments: [],
};

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SearchService],
    });
    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('search()', () => {
    it('should GET /api/search with query and default limit', () => {
      service.search('test').subscribe((result) => {
        expect(result).toEqual(MOCK_SEARCH_RESULTS);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/search' &&
          r.params.get('q') === 'test' &&
          r.params.get('limit') === '20',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_SEARCH_RESULTS);
    });

    it('should use custom limit when provided', () => {
      service.search('query', 5).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/search' &&
          r.params.get('q') === 'query' &&
          r.params.get('limit') === '5',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_SEARCH_RESULTS);
    });

    it('should return empty results when no matches', () => {
      const emptyResults: SearchResults = {
        tasks: [],
        boards: [],
        comments: [],
      };

      service.search('nonexistent').subscribe((result) => {
        expect(result.tasks).toEqual([]);
        expect(result.boards).toEqual([]);
        expect(result.comments).toEqual([]);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/search' && r.params.get('q') === 'nonexistent',
      );
      req.flush(emptyResults);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on search', () => {
      let error: any;
      service.search('test').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/search' && r.params.get('q') === 'test',
      );
      req.flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      expect(error).toBeTruthy();
      expect(error.status).toBe(500);
    });
  });
});
