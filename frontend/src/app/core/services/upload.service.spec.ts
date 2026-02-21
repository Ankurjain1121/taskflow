import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  let service: UploadService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UploadService],
    });
    service = TestBed.inject(UploadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAvatarUploadUrl()', () => {
    it('should POST /api/uploads/avatar with file metadata', () => {
      const response = {
        upload_url: 'https://minio.example.com/upload',
        storage_key: 'avatars/user-1/photo.png',
      };

      service
        .getAvatarUploadUrl('photo.png', 1024, 'image/png')
        .subscribe((result) => {
          expect(result).toEqual(response);
        });

      const req = httpMock.expectOne('/api/uploads/avatar');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        file_name: 'photo.png',
        file_size: 1024,
        mime_type: 'image/png',
      });
      req.flush(response);
    });
  });

  describe('confirmAvatarUpload()', () => {
    it('should POST /api/uploads/avatar/confirm with storage key', () => {
      const response = { avatar_url: '/avatars/user-1/photo.png' };

      service
        .confirmAvatarUpload('avatars/user-1/photo.png')
        .subscribe((result) => {
          expect(result).toEqual(response);
        });

      const req = httpMock.expectOne('/api/uploads/avatar/confirm');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        storage_key: 'avatars/user-1/photo.png',
      });
      req.flush(response);
    });
  });

  describe('getLogoUploadUrl()', () => {
    it('should POST /api/uploads/workspace-logo with workspace id and file metadata', () => {
      const response = {
        upload_url: 'https://minio.example.com/upload-logo',
        storage_key: 'logos/ws-1/logo.png',
      };

      service
        .getLogoUploadUrl('ws-1', 'logo.png', 2048, 'image/png')
        .subscribe((result) => {
          expect(result).toEqual(response);
        });

      const req = httpMock.expectOne('/api/uploads/workspace-logo');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        workspace_id: 'ws-1',
        file_name: 'logo.png',
        file_size: 2048,
        mime_type: 'image/png',
      });
      req.flush(response);
    });
  });

  describe('confirmLogoUpload()', () => {
    it('should POST /api/uploads/workspace-logo/confirm with workspace id and storage key', () => {
      const response = { logo_url: '/logos/ws-1/logo.png' };

      service
        .confirmLogoUpload('ws-1', 'logos/ws-1/logo.png')
        .subscribe((result) => {
          expect(result).toEqual(response);
        });

      const req = httpMock.expectOne('/api/uploads/workspace-logo/confirm');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        workspace_id: 'ws-1',
        storage_key: 'logos/ws-1/logo.png',
      });
      req.flush(response);
    });
  });

  describe('uploadFileToPresignedUrl()', () => {
    it('should PUT file to the presigned URL with Content-Type header', () => {
      const file = new File(['content'], 'test.png', { type: 'image/png' });
      const presignedUrl = 'https://minio.example.com/presigned-upload';

      service.uploadFileToPresignedUrl(presignedUrl, file).subscribe();

      const req = httpMock.expectOne(presignedUrl);
      expect(req.request.method).toBe('PUT');
      expect(req.request.headers.get('Content-Type')).toBe('image/png');
      req.flush(null);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on getAvatarUploadUrl', () => {
      let error: any;
      service.getAvatarUploadUrl('photo.png', 1024, 'image/png').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/uploads/avatar');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });
  });
});
