import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  FilterPresetsService,
  FilterPreset,
  CreateFilterPresetRequest,
  UpdateFilterPresetRequest,
} from './filter-presets.service';

const MOCK_PRESET: FilterPreset = {
  id: 'preset-1',
  user_id: 'user-1',
  board_id: 'board-1',
  name: 'My Preset',
  filters: { status: 'open' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('FilterPresetsService', () => {
  let service: FilterPresetsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FilterPresetsService],
    });

    service = TestBed.inject(FilterPresetsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  describe('list()', () => {
    it('sends GET /api/boards/{boardId}/filter-presets', () => {
      service.list('board-1').subscribe((result) => {
        expect(result).toEqual([MOCK_PRESET]);
      });

      const req = httpMock.expectOne('/api/boards/board-1/filter-presets');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_PRESET]);
    });
  });

  describe('create()', () => {
    it('sends POST /api/boards/{boardId}/filter-presets with the request body', () => {
      const body: CreateFilterPresetRequest = {
        name: 'New Preset',
        filters: { priority: 'high' },
      };

      service.create('board-1', body).subscribe((result) => {
        expect(result).toEqual(MOCK_PRESET);
      });

      const req = httpMock.expectOne('/api/boards/board-1/filter-presets');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(MOCK_PRESET);
    });
  });

  describe('update()', () => {
    it('sends PUT /api/boards/{boardId}/filter-presets/{presetId} with the request body', () => {
      const body: UpdateFilterPresetRequest = { name: 'Updated Preset' };

      service.update('board-1', 'preset-1', body).subscribe((result) => {
        expect(result).toEqual(MOCK_PRESET);
      });

      const req = httpMock.expectOne(
        '/api/boards/board-1/filter-presets/preset-1',
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush(MOCK_PRESET);
    });
  });

  describe('delete()', () => {
    it('sends DELETE /api/boards/{boardId}/filter-presets/{presetId}', () => {
      service.delete('board-1', 'preset-1').subscribe((result) => {
        expect(result).toEqual({ message: 'deleted' });
      });

      const req = httpMock.expectOne(
        '/api/boards/board-1/filter-presets/preset-1',
      );
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'deleted' });
    });
  });
});
