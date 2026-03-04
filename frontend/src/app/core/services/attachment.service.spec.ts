import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  AttachmentService,
  Attachment,
  UploadUrlResponse,
  DownloadUrlResponse,
  ConfirmUploadRequest,
} from './attachment.service';

const MOCK_ATTACHMENT: Attachment = {
  id: 'att-1',
  task_id: 'task-1',
  file_name: 'document.pdf',
  file_size: 5000,
  mime_type: 'application/pdf',
  storage_key: 'attachments/task-1/document.pdf',
  uploaded_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  uploader: {
    id: 'user-1',
    display_name: 'Test User',
    avatar_url: null,
  },
};

const MOCK_UPLOAD_URL: UploadUrlResponse = {
  uploadUrl: 'https://minio.example.com/upload',
  storageKey: 'attachments/task-1/document.pdf',
};

describe('AttachmentService', () => {
  let service: AttachmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AttachmentService],
    });
    service = TestBed.inject(AttachmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getUploadUrl()', () => {
    it('should POST /api/tasks/:taskId/attachments/upload-url', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      });

      service.getUploadUrl('task-1', file).subscribe((result) => {
        expect(result).toEqual(MOCK_UPLOAD_URL);
      });

      const req = httpMock.expectOne(
        '/api/tasks/task-1/attachments/upload-url',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        fileName: 'document.pdf',
        fileSize: 7,
        mimeType: 'application/pdf',
      });
      req.flush(MOCK_UPLOAD_URL);
    });

    it('should default mimeType to application/octet-stream for unknown types', () => {
      const file = new File(['content'], 'data.bin', { type: '' });

      service.getUploadUrl('task-1', file).subscribe();

      const req = httpMock.expectOne(
        '/api/tasks/task-1/attachments/upload-url',
      );
      expect(req.request.body.mimeType).toBe('application/octet-stream');
      req.flush(MOCK_UPLOAD_URL);
    });
  });

  describe('confirmUpload()', () => {
    it('should POST /api/tasks/:taskId/attachments/confirm', () => {
      const confirmReq: ConfirmUploadRequest = {
        storageKey: 'attachments/task-1/document.pdf',
        fileName: 'document.pdf',
        fileSize: 5000,
        mimeType: 'application/pdf',
      };

      service.confirmUpload('task-1', confirmReq).subscribe((result) => {
        expect(result).toEqual(MOCK_ATTACHMENT);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/attachments/confirm');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(confirmReq);
      req.flush(MOCK_ATTACHMENT);
    });
  });

  describe('getDownloadUrl()', () => {
    it('should GET /api/attachments/:id/download-url', () => {
      const response: DownloadUrlResponse = {
        downloadUrl: 'https://minio.example.com/download',
      };

      service.getDownloadUrl('att-1').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/attachments/att-1/download-url');
      expect(req.request.method).toBe('GET');
      req.flush(response);
    });
  });

  describe('listByTask()', () => {
    it('should GET /api/tasks/:taskId/attachments', () => {
      const attachments = [MOCK_ATTACHMENT];

      service.listByTask('task-1').subscribe((result) => {
        expect(result).toEqual(attachments);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/attachments');
      expect(req.request.method).toBe('GET');
      req.flush(attachments);
    });
  });

  describe('delete()', () => {
    it('should DELETE /api/attachments/:id', () => {
      service.delete('att-1').subscribe();

      const req = httpMock.expectOne('/api/attachments/att-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on listByTask', () => {
      let error: any;
      service.listByTask('task-bad').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-bad/attachments');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });

    it('should propagate HTTP errors on delete', () => {
      let error: any;
      service.delete('att-bad').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/attachments/att-bad');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
