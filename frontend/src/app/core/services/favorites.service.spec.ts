import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  FavoritesService,
  FavoriteItem,
  AddFavoriteRequest,
} from './favorites.service';

const MOCK_FAVORITE: FavoriteItem = {
  id: 'fav-1',
  entity_type: 'task',
  entity_id: 'task-1',
  name: 'Test Task',
  project_id: 'board-1',
  workspace_id: 'ws-1',
  created_at: '2026-01-01T00:00:00Z',
};

describe('FavoritesService', () => {
  let service: FavoritesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FavoritesService],
    });
    service = TestBed.inject(FavoritesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('list()', () => {
    it('should GET /api/favorites', () => {
      const favorites = [MOCK_FAVORITE];

      service.list().subscribe((result) => {
        expect(result).toEqual(favorites);
      });

      const req = httpMock.expectOne('/api/favorites');
      expect(req.request.method).toBe('GET');
      req.flush(favorites);
    });
  });

  describe('add()', () => {
    it('should POST /api/favorites with request body', () => {
      const addReq: AddFavoriteRequest = {
        entity_type: 'task',
        entity_id: 'task-1',
      };
      const response = { id: 'fav-1', success: true };

      service.add(addReq).subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/favorites');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(addReq);
      req.flush(response);
    });
  });

  describe('remove()', () => {
    it('should DELETE /api/favorites/:entityType/:entityId', () => {
      const response = { success: true };

      service.remove('task', 'task-1').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/favorites/task/task-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(response);
    });
  });

  describe('check()', () => {
    it('should GET /api/favorites/check/:entityType/:entityId', () => {
      const response = { favorited: true };

      service.check('task', 'task-1').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/favorites/check/task/task-1');
      expect(req.request.method).toBe('GET');
      req.flush(response);
    });

    it('should return favorited false', () => {
      const response = { favorited: false };

      service.check('project', 'board-1').subscribe((result) => {
        expect(result.favorited).toBe(false);
      });

      const req = httpMock.expectOne('/api/favorites/check/board/board-1');
      req.flush(response);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on list', () => {
      let error: any;
      service.list().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/favorites');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(401);
    });
  });
});
