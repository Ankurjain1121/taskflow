import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ImportExportService,
  ImportResult,
  TrelloImportResult,
  ImportTaskItem,
  ExportBoardJson,
} from './import-export.service';

describe('ImportExportService', () => {
  let service: ImportExportService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ImportExportService],
    });
    service = TestBed.inject(ImportExportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('exportCsv()', () => {
    it('should GET /api/boards/:boardId/export with format=csv and blob responseType', () => {
      const csvBlob = new Blob(['title,priority\nTask 1,high'], { type: 'text/csv' });

      service.exportCsv('board-1').subscribe((result) => {
        expect(result).toBeTruthy();
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/boards/board-1/export',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('format')).toBe('csv');
      expect(req.request.responseType).toBe('blob');
      req.flush(csvBlob);
    });
  });

  describe('exportJson()', () => {
    it('should GET /api/boards/:boardId/export with format=json', () => {
      const jsonExport: ExportBoardJson = {
        board: { id: 'board-1', name: 'Test', description: null, exported_at: '2026-02-20T00:00:00Z' },
        columns: [{ id: 'col-1', name: 'To Do', position: '1000', color: '#3b82f6' }],
        tasks: [],
      };

      service.exportJson('board-1').subscribe((result) => {
        expect(result).toEqual(jsonExport);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/boards/board-1/export',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('format')).toBe('json');
      req.flush(jsonExport);
    });
  });

  describe('importJson()', () => {
    it('should POST /api/boards/:boardId/import with tasks array', () => {
      const tasks: ImportTaskItem[] = [
        { title: 'Task 1', priority: 'high' },
        { title: 'Task 2', column_name: 'Done' },
      ];
      const result: ImportResult = { imported_count: 2 };

      service.importJson('board-1', tasks).subscribe((res) => {
        expect(res).toEqual(result);
      });

      const req = httpMock.expectOne('/api/boards/board-1/import');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(tasks);
      req.flush(result);
    });
  });

  describe('importCsv()', () => {
    it('should POST /api/boards/:boardId/import/csv with csv_text', () => {
      const csvText = 'title,priority\nTask 1,high';
      const result: ImportResult = { imported_count: 1 };

      service.importCsv('board-1', csvText).subscribe((res) => {
        expect(res).toEqual(result);
      });

      const req = httpMock.expectOne('/api/boards/board-1/import/csv');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ csv_text: csvText });
      req.flush(result);
    });
  });

  describe('importTrello()', () => {
    it('should POST /api/boards/:boardId/import/trello with trello data', () => {
      const trelloData = { name: 'Trello Board', lists: [] };
      const result: TrelloImportResult = {
        imported_count: 5,
        columns_created: 3,
        skipped: 0,
      };

      service.importTrello('board-1', trelloData).subscribe((res) => {
        expect(res).toEqual(result);
      });

      const req = httpMock.expectOne('/api/boards/board-1/import/trello');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(trelloData);
      req.flush(result);
    });
  });
});
