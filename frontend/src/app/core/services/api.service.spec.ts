import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ApiService } from './api.service';

/**
 * ApiService Tests
 *
 * Critical coverage for HTTP client wrapper that all features depend on.
 * This is a foundational service — all API calls go through here.
 */
describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('GET requests', () => {
    it('should make GET request to correct endpoint', () => {
      const endpoint = '/boards';
      const mockData = { id: '123', name: 'Test Board' };

      service.get(endpoint).subscribe((data) => {
        expect(data).toEqual(mockData);
      });

      const req = httpMock.expectOne(`${baseUrl}${endpoint}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockData);
    });

    it('should prepend /api base URL to path', () => {
      const endpoint = '/workspaces';
      const mockData = [{ id: '1', name: 'Workspace 1' }];

      service.get(endpoint).subscribe((data) => {
        expect(data).toEqual(mockData);
      });

      const req = httpMock.expectOne(`${baseUrl}${endpoint}`);
      expect(req.request.url).toBe('/api/workspaces');
      req.flush(mockData);
    });

    it('should handle 404 error response', () => {
      return new Promise<void>((resolve) => {
        service.get('/nonexistent').subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(404);
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/nonexistent`);
        req.flush(null, { status: 404, statusText: 'Not Found' });
      });
    });

    it('should handle 500 server error', () => {
      return new Promise<void>((resolve) => {
        service.get('/boards').subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(500);
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/boards`);
        req.flush('Server error', {
          status: 500,
          statusText: 'Internal Server Error',
        });
      });
    });

    it('should handle 403 Forbidden (permission denied)', () => {
      return new Promise<void>((resolve) => {
        service.get('/admin/users').subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(403);
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/admin/users`);
        req.flush(null, { status: 403, statusText: 'Forbidden' });
      });
    });
  });

  describe('POST requests', () => {
    it('should make POST request with body', () => {
      const endpoint = '/tasks';
      const body = { title: 'New Task', boardId: '123' };
      const response = { id: 'task-1', ...body };

      service.post(endpoint, body).subscribe((data) => {
        expect(data).toEqual(response);
      });

      const req = httpMock.expectOne(`${baseUrl}${endpoint}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(response);
    });

    it('should handle 400 Bad Request (validation error)', () => {
      return new Promise<void>((resolve) => {
        service.post('/tasks', {}).subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(400);
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/tasks`);
        req.flush(
          { error: 'Title is required' },
          { status: 400, statusText: 'Bad Request' },
        );
      });
    });

    it('should handle 409 Conflict (version mismatch)', () => {
      return new Promise<void>((resolve) => {
        service
          .post('/tasks/1/update', { expected_version: 1, title: 'Updated' })
          .subscribe({
            next: () => fail('should have failed'),
            error: (error) => {
              expect(error.status).toBe(409);
              resolve();
            },
          });

        const req = httpMock.expectOne(`${baseUrl}/tasks/1/update`);
        req.flush(
          { error: 'Version mismatch - conflict detected' },
          { status: 409, statusText: 'Conflict' },
        );
      });
    });
  });

  describe('PUT requests', () => {
    it('should make PUT request with body', () => {
      const endpoint = '/projects/123';
      const body = { name: 'Updated Name' };
      const response = { id: '123', ...body };

      service.put(endpoint, body).subscribe((data) => {
        expect(data).toEqual(response);
      });

      const req = httpMock.expectOne(`${baseUrl}${endpoint}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush(response);
    });
  });

  describe('PATCH requests', () => {
    it('should make PATCH request with body', () => {
      const endpoint = '/tasks/1';
      const body = { status: 'done' };
      const response = { id: '1', ...body };

      service.patch(endpoint, body).subscribe((data) => {
        expect(data).toEqual(response);
      });

      const req = httpMock.expectOne(`${baseUrl}${endpoint}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(body);
      req.flush(response);
    });
  });

  describe('DELETE requests', () => {
    it('should make DELETE request', () => {
      const endpoint = '/tasks/123';

      service.delete(endpoint).subscribe();

      const req = httpMock.expectOne(`${baseUrl}${endpoint}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should handle 204 No Content response', () => {
      const endpoint = '/tasks/123';

      service.delete(endpoint).subscribe((data) => {
        expect(data).toBeNull();
      });

      const req = httpMock.expectOne(`${baseUrl}${endpoint}`);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('should handle 404 on delete (already deleted)', () => {
      return new Promise<void>((resolve) => {
        service.delete('/tasks/999').subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(404);
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/tasks/999`);
        req.flush(null, { status: 404, statusText: 'Not Found' });
      });
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle network timeout', () => {
      return new Promise<void>((resolve) => {
        service.get('/boards').subscribe({
          next: () => fail('should have timed out'),
          error: (error) => {
            // Timeout errors don't have a status code
            expect(error).toBeDefined();
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/boards`);
        req.error(new ProgressEvent('timeout'));
      });
    });

    it('should handle 429 Too Many Requests (rate limiting)', () => {
      return new Promise<void>((resolve) => {
        service.get('/search').subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(429);
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/search`);
        req.flush(null, { status: 429, statusText: 'Too Many Requests' });
      });
    });

    it('should handle 401 Unauthorized (session expired)', () => {
      return new Promise<void>((resolve) => {
        service.get('/profile').subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(401);
            resolve();
          },
        });

        const req = httpMock.expectOne(`${baseUrl}/profile`);
        req.flush(null, { status: 401, statusText: 'Unauthorized' });
      });
    });
  });

  describe('Request headers', () => {
    it('should send POST body as JSON object', () => {
      const body = { title: 'Test' };
      service.post('/tasks', body).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/tasks`);
      expect(req.request.body).toEqual(body);
      expect(typeof req.request.body).toBe('object');
      req.flush({});
    });
  });

  describe('Empty responses', () => {
    it('should handle empty array response', () => {
      service.get('/empty-list').subscribe((data) => {
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(0);
      });

      const req = httpMock.expectOne(`${baseUrl}/empty-list`);
      req.flush([]);
    });

    it('should handle null response', () => {
      service.get('/nullable').subscribe((data) => {
        expect(data).toBeNull();
      });

      const req = httpMock.expectOne(`${baseUrl}/nullable`);
      req.flush(null);
    });
  });

  describe('Request Deduplication (GET)', () => {
    it('should deduplicate concurrent GET requests to same endpoint', () => {
      return new Promise<void>((resolve) => {
        const endpoint = '/boards';
        const mockData = { id: '123', name: 'Test Board' };

        // Make two concurrent GET requests to same endpoint
        let subscriber1Received = false;
        let subscriber2Received = false;

        service.get(endpoint).subscribe((data) => {
          expect(data).toEqual(mockData);
          subscriber1Received = true;
          if (subscriber1Received && subscriber2Received) {
            resolve();
          }
        });

        service.get(endpoint).subscribe((data) => {
          expect(data).toEqual(mockData);
          subscriber2Received = true;
          if (subscriber1Received && subscriber2Received) {
            resolve();
          }
        });

        // Should only have ONE HTTP request despite TWO subscribers
        const requests = httpMock.match(`${baseUrl}${endpoint}`);
        expect(requests.length).toBe(1); // Critical: single HTTP call
        requests[0].flush(mockData);
      });
    });

    it('should NOT deduplicate requests to different endpoints', () => {
      const endpoint1 = '/boards';
      const endpoint2 = '/tasks';

      service.get(endpoint1).subscribe();
      service.get(endpoint2).subscribe();

      // Should have two separate HTTP requests
      const reqs = httpMock.match(() => true);
      expect(reqs.length).toBe(2);
      reqs.forEach((req) => req.flush({}));
    });

    it('should deduplicate three or more concurrent requests', () => {
      return new Promise<void>((resolve) => {
        const endpoint = '/tasks';
        const mockData = [{ id: 't1', title: 'Task 1' }];
        let completedSubscribers = 0;

        const checkDone = () => {
          completedSubscribers++;
          if (completedSubscribers === 3) {
            resolve();
          }
        };

        service.get(endpoint).subscribe((data) => {
          expect(data).toEqual(mockData);
          checkDone();
        });

        service.get(endpoint).subscribe((data) => {
          expect(data).toEqual(mockData);
          checkDone();
        });

        service.get(endpoint).subscribe((data) => {
          expect(data).toEqual(mockData);
          checkDone();
        });

        // Should have only ONE HTTP request
        const requests = httpMock.match(`${baseUrl}${endpoint}`);
        expect(requests.length).toBe(1);
        requests[0].flush(mockData);
      });
    });

    it('should clean up pending request map after completion', () => {
      const endpoint = '/boards';

      // First request
      service.get(endpoint).subscribe();
      const firstRequest = httpMock.expectOne(`${baseUrl}${endpoint}`);
      firstRequest.flush({});

      // After first completes, dedup map should be cleaned up
      // So a new request to same endpoint should create a new HTTP call
      service.get(endpoint).subscribe();
      const secondRequest = httpMock.expectOne(`${baseUrl}${endpoint}`);
      secondRequest.flush({});
    });

    it('should handle error in deduplicated request', () => {
      return new Promise<void>((resolve) => {
        const endpoint = '/boards';
        let errorSubscriber1Received = false;
        let errorSubscriber2Received = false;

        service.get(endpoint).subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(404);
            errorSubscriber1Received = true;
            if (errorSubscriber1Received && errorSubscriber2Received) {
              resolve();
            }
          },
        });

        service.get(endpoint).subscribe({
          next: () => fail('should have failed'),
          error: (error) => {
            expect(error.status).toBe(404);
            errorSubscriber2Received = true;
            if (errorSubscriber1Received && errorSubscriber2Received) {
              resolve();
            }
          },
        });

        // Should only have ONE HTTP request despite TWO subscribers
        const requests = httpMock.match(`${baseUrl}${endpoint}`);
        expect(requests.length).toBe(1);
        requests[0].flush(null, { status: 404, statusText: 'Not Found' });
      });
    });
  });

  describe('POST/PUT/PATCH/DELETE do NOT deduplicate', () => {
    it('should NOT deduplicate POST requests (mutations should not be deduplicated)', () => {
      const endpoint = '/tasks';
      const body = { title: 'New Task' };

      service.post(endpoint, body).subscribe();
      service.post(endpoint, body).subscribe();

      // Should have two separate HTTP requests (mutations are not deduplicated)
      const requests = httpMock.match(`${baseUrl}${endpoint}`);
      expect(requests.length).toBe(2);
      requests.forEach((req) => req.flush({}));
    });

    it('should NOT deduplicate DELETE requests', () => {
      const endpoint = '/tasks/123';

      service.delete(endpoint).subscribe();
      service.delete(endpoint).subscribe();

      // Should have two separate HTTP requests
      const requests = httpMock.match(`${baseUrl}${endpoint}`);
      expect(requests.length).toBe(2);
      requests.forEach((req) => req.flush(null));
    });
  });
});
