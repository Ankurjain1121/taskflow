import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';

import {
  CommentListComponent,
  RenderMentionsPipe,
} from './comment-list.component';
import {
  CommentService,
  Comment,
} from '../../../../core/services/comment.service';
import {
  WebSocketService,
  WebSocketMessage,
} from '../../../../core/services/websocket.service';

function createMockComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    task_id: 'task-1',
    content: 'Test comment',
    author_id: 'user-1',
    parent_id: null,
    mentioned_user_ids: [],
    created_at: '2026-02-18T10:00:00Z',
    updated_at: '2026-02-18T10:00:00Z',
    author: {
      id: 'user-1',
      display_name: 'Alice Smith',
      avatar_url: null,
    },
    ...overrides,
  };
}

// Stub child component to avoid importing the real one
@Component({
  selector: 'app-comment-input',
  standalone: true,
  template: '',
})
class MockCommentInputComponent {
  taskId = input<string>();
  workspaceId = input<string>();
  parentId = input<string>();
}

describe('CommentListComponent', () => {
  let component: CommentListComponent;
  let fixture: ComponentFixture<CommentListComponent>;

  const wsMessages$ = new Subject<WebSocketMessage>();

  const mockCommentService = {
    listByTask: vi.fn().mockReturnValue(of([])),
    create: vi.fn().mockReturnValue(of(createMockComment())),
    update: vi.fn().mockReturnValue(of(createMockComment())),
    delete: vi.fn().mockReturnValue(of(undefined)),
  };

  const mockWsService = {
    messages$: wsMessages$.asObservable(),
    connect: vi.fn(),
    send: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        CommentListComponent,
        HttpClientTestingModule,
      ],
      providers: [
        { provide: CommentService, useValue: mockCommentService },
        { provide: WebSocketService, useValue: mockWsService },
      ],
    })
      .overrideComponent(CommentListComponent, {
        remove: { imports: [await import('../comment-input/comment-input.component').then(m => m.CommentInputComponent)] },
        add: { imports: [MockCommentInputComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CommentListComponent);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput('taskId', 'task-1');
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial empty comments', () => {
    expect(component.comments()).toEqual([]);
  });

  it('should have initial loading as false', () => {
    expect(component.isLoading()).toBe(false);
  });

  it('should have initial replyingTo as null', () => {
    expect(component.replyingTo()).toBeNull();
  });

  describe('loadComments()', () => {
    it('should set isLoading to true then false', () => {
      const comments = [createMockComment()];
      mockCommentService.listByTask.mockReturnValue(of(comments));

      component.loadComments();

      expect(component.isLoading()).toBe(false);
      expect(mockCommentService.listByTask).toHaveBeenCalledWith('task-1');
    });

    it('should populate comments signal with results', () => {
      const comments = [
        createMockComment({ id: 'c1' }),
        createMockComment({ id: 'c2' }),
      ];
      mockCommentService.listByTask.mockReturnValue(of(comments));

      component.loadComments();

      expect(component.comments()).toHaveLength(2);
      expect(component.comments()[0].id).toBe('c1');
    });

    it('should handle error and set isLoading to false', () => {
      mockCommentService.listByTask.mockReturnValue(throwError(() => new Error('fail')));

      component.loadComments();

      expect(component.isLoading()).toBe(false);
      expect(component.comments()).toEqual([]);
    });
  });

  describe('onCommentCreated()', () => {
    it('should append new comment to comments list', () => {
      component.comments.set([createMockComment({ id: 'existing' })]);
      const newComment = createMockComment({ id: 'new-comment' });

      component.onCommentCreated(newComment);

      expect(component.comments()).toHaveLength(2);
      expect(component.comments()[1].id).toBe('new-comment');
    });

    it('should not mutate the existing comments array', () => {
      const initial = [createMockComment({ id: 'c1' })];
      component.comments.set(initial);

      component.onCommentCreated(createMockComment({ id: 'c2' }));

      // Original array reference should be unchanged
      expect(initial).toHaveLength(1);
      expect(component.comments()).toHaveLength(2);
    });
  });

  describe('onReplyCreated()', () => {
    it('should append reply to comments list', () => {
      component.comments.set([createMockComment({ id: 'parent' })]);
      const reply = createMockComment({ id: 'reply-1', parent_id: 'parent' });

      component.onReplyCreated(reply);

      expect(component.comments()).toHaveLength(2);
      expect(component.comments()[1].id).toBe('reply-1');
    });

    it('should reset replyingTo to null', () => {
      component.replyingTo.set('parent');

      component.onReplyCreated(createMockComment({ id: 'reply', parent_id: 'parent' }));

      expect(component.replyingTo()).toBeNull();
    });
  });

  describe('toggleReply()', () => {
    it('should set replyingTo to the comment id', () => {
      component.toggleReply('comment-abc');

      expect(component.replyingTo()).toBe('comment-abc');
    });

    it('should reset replyingTo to null if already replying to same comment', () => {
      component.replyingTo.set('comment-abc');

      component.toggleReply('comment-abc');

      expect(component.replyingTo()).toBeNull();
    });

    it('should switch to a different comment id', () => {
      component.replyingTo.set('comment-1');

      component.toggleReply('comment-2');

      expect(component.replyingTo()).toBe('comment-2');
    });
  });

  describe('getInitials()', () => {
    it('should return first letters of first and last name', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
    });

    it('should return single initial for single name', () => {
      expect(component.getInitials('Alice')).toBe('A');
    });

    it('should return uppercase initials', () => {
      expect(component.getInitials('alice smith')).toBe('AS');
    });

    it('should limit to 2 characters for names with many parts', () => {
      expect(component.getInitials('Alice Bob Charlie')).toBe('AB');
    });

    it('should handle empty string', () => {
      expect(component.getInitials('')).toBe('');
    });
  });

  describe('formatTimestamp()', () => {
    it('should return "just now" for timestamps less than 1 minute ago', () => {
      const now = new Date().toISOString();
      expect(component.formatTimestamp(now)).toBe('just now');
    });

    it('should return "Xm ago" for timestamps within the last hour', () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(component.formatTimestamp(fiveMinsAgo)).toBe('5m ago');
    });

    it('should return "Xh ago" for timestamps within the last day', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      expect(component.formatTimestamp(twoHoursAgo)).toBe('2h ago');
    });

    it('should return "Xd ago" for timestamps within the last week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      expect(component.formatTimestamp(threeDaysAgo)).toBe('3d ago');
    });

    it('should return formatted date for timestamps older than a week', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const result = component.formatTimestamp(twoWeeksAgo);
      // Should include month and day, not relative format
      expect(result).not.toContain('ago');
      expect(result).not.toContain('just now');
    });
  });

  describe('WebSocket integration', () => {
    it('should add new comment from websocket when it belongs to this task', () => {
      const existingComment = createMockComment({ id: 'c1' });
      component.comments.set([existingComment]);

      // Need to trigger subscribeToWebSocket by calling it through the effect
      // We simulate by detecting the component and triggering the loadComments + ws
      fixture.detectChanges();

      const wsComment = createMockComment({ id: 'ws-comment-1', task_id: 'task-1' });
      wsMessages$.next({
        type: 'comment:created',
        payload: { taskId: 'task-1', comment: wsComment },
      });

      const commentIds = component.comments().map((c) => c.id);
      expect(commentIds).toContain('ws-comment-1');
    });

    it('should not add duplicate comments from websocket', () => {
      const existing = createMockComment({ id: 'dup-1' });
      component.comments.set([existing]);
      fixture.detectChanges();

      wsMessages$.next({
        type: 'comment:created',
        payload: { taskId: 'task-1', comment: createMockComment({ id: 'dup-1' }) },
      });

      expect(component.comments()).toHaveLength(1);
    });

    it('should ignore websocket messages for different tasks', () => {
      component.comments.set([]);
      fixture.detectChanges();

      wsMessages$.next({
        type: 'comment:created',
        payload: {
          taskId: 'different-task',
          comment: createMockComment({ id: 'other-task-comment' }),
        },
      });

      expect(component.comments()).toHaveLength(0);
    });

    it('should ignore non-comment:created websocket messages', () => {
      component.comments.set([]);
      fixture.detectChanges();

      wsMessages$.next({
        type: 'task:updated',
        payload: { taskId: 'task-1' },
      });

      // Should not throw or add anything
      expect(component.comments()).toHaveLength(0);
    });
  });

  describe('ngOnDestroy()', () => {
    it('should not throw when destroyed', () => {
      fixture.detectChanges();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});

describe('RenderMentionsPipe', () => {
  let pipe: RenderMentionsPipe;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenderMentionsPipe],
    }).compileComponents();

    pipe = TestBed.inject(RenderMentionsPipe);
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should render mention syntax into styled HTML span', () => {
    const result = pipe.transform('@[Alice](abc-123)');
    // SafeHtml toString gives [object Object], so check the changingThisBreaksApplicationSecurity prop
    const html = (result as any).changingThisBreaksApplicationSecurity as string;
    expect(html).toContain('@Alice');
    expect(html).toContain('class="text-indigo-600');
    expect(html).not.toContain('@[Alice]');
  });

  it('should render multiple mentions', () => {
    const result = pipe.transform('Hello @[Alice](id-1) and @[Bob](id-2)!');
    const html = (result as any).changingThisBreaksApplicationSecurity as string;
    expect(html).toContain('@Alice');
    expect(html).toContain('@Bob');
  });

  it('should pass through text without mentions unchanged', () => {
    const result = pipe.transform('Just a regular comment');
    const html = (result as any).changingThisBreaksApplicationSecurity as string;
    expect(html).toContain('Just a regular comment');
    expect(html).not.toContain('class=');
  });

  it('should escape HTML to prevent XSS', () => {
    const malicious = '<script>alert("xss")</script>';
    const result = pipe.transform(malicious);
    const html = (result as any).changingThisBreaksApplicationSecurity as string;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should escape HTML before applying mention styling', () => {
    const mixed = '<img onerror="alert(1)" src=x> @[Alice](id-1)';
    const result = pipe.transform(mixed);
    const html = (result as any).changingThisBreaksApplicationSecurity as string;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('@Alice');
  });

  it('should handle empty string', () => {
    const result = pipe.transform('');
    const html = (result as any).changingThisBreaksApplicationSecurity as string;
    expect(html).toBe('');
  });
});
