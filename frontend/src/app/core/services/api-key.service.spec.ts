import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ApiKeyService,
  ApiKeyListItem,
  ApiKeyCreateResponse,
} from './api-key.service';

const MOCK_API_KEY: ApiKeyListItem = {
  id: 'key-1',
  name: 'My API Key',
  key_prefix: 'tf_abc',
  created_at: '2026-01-01T00:00:00Z',
};

const MOCK_CREATE_RESPONSE: ApiKeyCreateResponse = {
  id: 'key-1',
  name: 'My API Key',
  key_prefix: 'tf_abc',
  full_key: 'tf_abc_1234567890abcdef',
  created_at: '2026-01-01T00:00:00Z',
};

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiKeyService],
    });
    service = TestBed.inject(ApiKeyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createKey()', () => {
    it('should POST /api/workspaces/:workspaceId/api-keys with name', () => {
      service.createKey('ws-1', 'My API Key').subscribe((result) => {
        expect(result).toEqual(MOCK_CREATE_RESPONSE);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/api-keys');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'My API Key' });
      req.flush(MOCK_CREATE_RESPONSE);
    });
  });

  describe('listKeys()', () => {
    it('should GET /api/workspaces/:workspaceId/api-keys', () => {
      const keys = [MOCK_API_KEY];

      service.listKeys('ws-1').subscribe((result) => {
        expect(result).toEqual(keys);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/api-keys');
      expect(req.request.method).toBe('GET');
      req.flush(keys);
    });
  });

  describe('revokeKey()', () => {
    it('should DELETE /api/workspaces/:workspaceId/api-keys/:keyId', () => {
      service.revokeKey('ws-1', 'key-1').subscribe();

      const req = httpMock.expectOne('/api/workspaces/ws-1/api-keys/key-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on createKey', () => {
      let error: any;
      service.createKey('ws-1', '').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/api-keys');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });

    it('should propagate HTTP errors on revokeKey', () => {
      let error: any;
      service.revokeKey('ws-1', 'key-bad').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/api-keys/key-bad');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });
  });
});
