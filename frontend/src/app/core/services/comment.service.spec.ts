import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CommentService, Comment } from './comment.service';

/** Raw API shape (flat author fields) matching CommentFromApi */
interface CommentFromApi {
  id: string;
  task_id: string;
  content: string;
  author_id: string;
  parent_id: string | null;
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string;
  author_name: string;
  author_avatar_url: string | null;
}

const RAW_COMMENT: CommentFromApi = {
  id: 'comment-1',
  task_id: 'task-1',
  content: 'Hello world',
  author_id: 'user-1',
  parent_id: null,
  mentioned_user_ids: ['user-2'],
  created_at: '2026-02-18T10:00:00Z',
  updated_at: '2026-02-18T10:00:00Z',
  author_name: 'Alice',
  author_avatar_url: 'https://example.com/alice.png',
};

const MAPPED_COMMENT: Comment = {
  id: 'comment-1',
  task_id: 'task-1',
  content: 'Hello world',
  author_id: 'user-1',
  parent_id: null,
  mentioned_user_ids: ['user-2'],
  created_at: '2026-02-18T10:00:00Z',
  updated_at: '2026-02-18T10:00:00Z',
  author: {
    id: 'user-1',
    display_name: 'Alice',
    avatar_url: 'https://example.com/alice.png',
  },
};

const RAW_REPLY: CommentFromApi = {
  id: 'comment-2',
  task_id: 'task-1',
  content: 'Reply here',
  author_id: 'user-2',
  parent_id: 'comment-1',
  mentioned_user_ids: [],
  created_at: '2026-02-18T11:00:00Z',
  updated_at: '2026-02-18T11:00:00Z',
  author_name: 'Bob',
  author_avatar_url: null,
};

describe('CommentService', () => {
  let service: CommentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CommentService],
    });
    service = TestBed.inject(CommentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listByTask()', () => {
    it('should GET /api/tasks/:taskId/comments', () => {
      service.listByTask('task-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      expect(req.request.method).toBe('GET');
      req.flush({ comments: [RAW_COMMENT] });
    });

    it('should map flat API comments to nested author objects', () => {
      service.listByTask('task-1').subscribe((comments) => {
        expect(comments).toEqual([MAPPED_COMMENT]);
        expect(comments[0].author.display_name).toBe('Alice');
        expect(comments[0].author.id).toBe('user-1');
        expect(comments[0].author.avatar_url).toBe('https://example.com/alice.png');
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush({ comments: [RAW_COMMENT] });
    });

    it('should map multiple comments including replies', () => {
      service.listByTask('task-1').subscribe((comments) => {
        expect(comments.length).toBe(2);
        expect(comments[0].parent_id).toBeNull();
        expect(comments[1].parent_id).toBe('comment-1');
        expect(comments[1].author.display_name).toBe('Bob');
        expect(comments[1].author.avatar_url).toBeNull();
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush({ comments: [RAW_COMMENT, RAW_REPLY] });
    });

    it('should handle empty comments list', () => {
      service.listByTask('task-empty').subscribe((comments) => {
        expect(comments).toEqual([]);
      });

      const req = httpMock.expectOne('/api/tasks/task-empty/comments');
      req.flush({ comments: [] });
    });
  });

  describe('create()', () => {
    it('should POST to /api/tasks/:taskId/comments with content', () => {
      service.create('task-1', 'New comment').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ content: 'New comment' });
      req.flush(RAW_COMMENT);
    });

    it('should include parent_id when provided', () => {
      service.create('task-1', 'Reply text', 'comment-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        content: 'Reply text',
        parent_id: 'comment-1',
      });
      req.flush(RAW_REPLY);
    });

    it('should not include parent_id when not provided', () => {
      service.create('task-1', 'Top-level comment').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      expect(req.request.body.parent_id).toBeUndefined();
      req.flush(RAW_COMMENT);
    });

    it('should map the created comment response through mapComment', () => {
      service.create('task-1', 'Hello world').subscribe((comment) => {
        expect(comment.author).toBeDefined();
        expect(comment.author.display_name).toBe('Alice');
        expect(comment.author.id).toBe('user-1');
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush(RAW_COMMENT);
    });
  });

  describe('update()', () => {
    it('should PUT to /api/comments/:id with content', () => {
      const updatedComment: Comment = {
        ...MAPPED_COMMENT,
        content: 'Updated content',
      };

      service.update('comment-1', 'Updated content').subscribe((comment) => {
        expect(comment.content).toBe('Updated content');
      });

      const req = httpMock.expectOne('/api/comments/comment-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ content: 'Updated content' });
      req.flush(updatedComment);
    });
  });

  describe('delete()', () => {
    it('should DELETE /api/comments/:id', () => {
      service.delete('comment-1').subscribe();

      const req = httpMock.expectOne('/api/comments/comment-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('mapComment transformation', () => {
    it('should map author_name to author.display_name', () => {
      service.listByTask('task-1').subscribe((comments) => {
        expect(comments[0].author.display_name).toBe('Alice');
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush({ comments: [RAW_COMMENT] });
    });

    it('should map author_avatar_url to author.avatar_url', () => {
      service.listByTask('task-1').subscribe((comments) => {
        expect(comments[0].author.avatar_url).toBe('https://example.com/alice.png');
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush({ comments: [RAW_COMMENT] });
    });

    it('should set author.id from author_id', () => {
      service.listByTask('task-1').subscribe((comments) => {
        expect(comments[0].author.id).toBe(comments[0].author_id);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush({ comments: [RAW_COMMENT] });
    });

    it('should handle null avatar_url', () => {
      const rawNoAvatar: CommentFromApi = {
        ...RAW_COMMENT,
        author_avatar_url: null,
      };

      service.listByTask('task-1').subscribe((comments) => {
        expect(comments[0].author.avatar_url).toBeNull();
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush({ comments: [rawNoAvatar] });
    });

    it('should preserve all original fields alongside nested author', () => {
      service.listByTask('task-1').subscribe((comments) => {
        const c = comments[0];
        expect(c.id).toBe('comment-1');
        expect(c.task_id).toBe('task-1');
        expect(c.content).toBe('Hello world');
        expect(c.author_id).toBe('user-1');
        expect(c.parent_id).toBeNull();
        expect(c.mentioned_user_ids).toEqual(['user-2']);
        expect(c.created_at).toBe('2026-02-18T10:00:00Z');
        expect(c.updated_at).toBe('2026-02-18T10:00:00Z');
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush({ comments: [RAW_COMMENT] });
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on listByTask', () => {
      let error: any;
      service.listByTask('task-1').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });

    it('should propagate HTTP errors on create', () => {
      let error: any;
      service.create('task-1', 'fail').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-1/comments');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
