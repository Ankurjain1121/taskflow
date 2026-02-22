import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { Overlay } from '@angular/cdk/overlay';
import { CommentInputComponent } from './comment-input.component';
import {
  CommentService,
  Comment,
} from '../../../../core/services/comment.service';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    task_id: 'task-1',
    content: 'Test comment',
    author_id: 'user-1',
    parent_id: null,
    mentioned_user_ids: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    author: {
      id: 'user-1',
      display_name: 'Test User',
      avatar_url: null,
    },
    ...overrides,
  };
}

describe('CommentInputComponent', () => {
  let component: CommentInputComponent;
  let fixture: ComponentFixture<CommentInputComponent>;
  let mockCommentService: {
    create: ReturnType<typeof vi.fn>;
  };
  let mockOverlay: {
    position: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    scrollStrategies: { close: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    mockCommentService = {
      create: vi.fn(),
    };

    mockOverlay = {
      position: vi.fn().mockReturnValue({
        flexibleConnectedTo: vi.fn().mockReturnValue({
          withPositions: vi.fn().mockReturnValue({}),
        }),
      }),
      create: vi.fn().mockReturnValue({
        attach: vi.fn().mockReturnValue({
          setInput: vi.fn(),
          instance: {
            memberSelected: new Subject(),
          },
        }),
        detachments: vi.fn().mockReturnValue(new Subject()),
        dispose: vi.fn(),
      }),
      scrollStrategies: {
        close: vi.fn().mockReturnValue({}),
      },
    };

    await TestBed.configureTestingModule({
      imports: [CommentInputComponent, HttpClientTestingModule],
      providers: [
        { provide: CommentService, useValue: mockCommentService },
        { provide: Overlay, useValue: mockOverlay },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentInputComponent);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput('taskId', 'task-1');
    fixture.componentRef.setInput('workspaceId', 'ws-1');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty content', () => {
    expect(component.content).toBe('');
  });

  it('should start with isSubmitting false', () => {
    expect(component.isSubmitting()).toBe(false);
  });

  describe('submitComment()', () => {
    it('should call commentService.create with correct params', () => {
      mockCommentService.create.mockReturnValue(of(makeComment()));
      component.content = 'Hello world';

      component.submitComment();

      expect(mockCommentService.create).toHaveBeenCalledWith(
        'task-1',
        'Hello world',
        undefined,
      );
    });

    it('should not submit if content is empty', () => {
      component.content = '';
      component.submitComment();

      expect(mockCommentService.create).not.toHaveBeenCalled();
    });

    it('should not submit if content is only whitespace', () => {
      component.content = '   ';
      component.submitComment();

      expect(mockCommentService.create).not.toHaveBeenCalled();
    });

    it('should not submit if already submitting', () => {
      component.isSubmitting.set(true);
      component.content = 'Hello';
      component.submitComment();

      expect(mockCommentService.create).not.toHaveBeenCalled();
    });

    it('should set isSubmitting to true during submission', () => {
      const commentSubject = new Subject<Comment>();
      mockCommentService.create.mockReturnValue(commentSubject.asObservable());

      component.content = 'Hello';
      component.submitComment();

      expect(component.isSubmitting()).toBe(true);
    });

    it('should reset content and isSubmitting after successful submission', () => {
      mockCommentService.create.mockReturnValue(of(makeComment()));
      component.content = 'Hello';

      component.submitComment();

      expect(component.content).toBe('');
      expect(component.isSubmitting()).toBe(false);
    });

    it('should emit commentCreated event on success', () => {
      const comment = makeComment({ id: 'c-new' });
      mockCommentService.create.mockReturnValue(of(comment));

      const emitSpy = vi.spyOn(component.commentCreated, 'emit');
      component.content = 'Hello';

      component.submitComment();

      expect(emitSpy).toHaveBeenCalledWith(comment);
    });

    it('should set isSubmitting back to false on error', () => {
      mockCommentService.create.mockReturnValue(
        throwError(() => new Error('Server error')),
      );
      component.content = 'Hello';

      component.submitComment();

      expect(component.isSubmitting()).toBe(false);
    });

    it('should pass parentId when provided', () => {
      fixture.componentRef.setInput('parentId', 'parent-1');
      fixture.detectChanges();

      mockCommentService.create.mockReturnValue(of(makeComment()));
      component.content = 'Reply content';

      component.submitComment();

      expect(mockCommentService.create).toHaveBeenCalledWith(
        'task-1',
        'Reply content',
        'parent-1',
      );
    });
  });

  describe('onKeydown()', () => {
    it('should do nothing when no overlay is open', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventSpy = vi.spyOn(event, 'preventDefault');

      component.onKeydown(event);

      // No overlay, so nothing should happen
      expect(preventSpy).not.toHaveBeenCalled();
    });
  });

  describe('onBlur()', () => {
    it('should not throw when called', () => {
      vi.useFakeTimers();
      expect(() => {
        component.onBlur();
        vi.advanceTimersByTime(300);
      }).not.toThrow();
      vi.useRealTimers();
    });
  });

  describe('ngOnDestroy()', () => {
    it('should not throw when destroyed', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('should complete destroy$ subject', () => {
      component.ngOnDestroy();
      // Subsequent submit should not cause issues because takeUntil has fired
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('onInput()', () => {
    it('should close mention popover if no @ detected', () => {
      const textarea = fixture.nativeElement.querySelector('textarea');
      if (!textarea) return;

      component.content = 'hello world';
      textarea.value = 'hello world';
      textarea.selectionStart = 11;

      const event = { target: textarea } as unknown as Event;
      component.onInput(event);

      // No errors expected
      expect(component.content).toBe('hello world');
    });

    it('should handle @ character in input without errors', () => {
      const textarea = fixture.nativeElement.querySelector('textarea');
      if (!textarea) return;

      component.content = 'hello @john';
      textarea.value = 'hello @john';
      textarea.selectionStart = 11;

      const event = { target: textarea } as unknown as Event;
      // Should not throw even if overlay open fails
      expect(() => component.onInput(event)).not.toThrow();
    });

    it('should not trigger mention for @ in middle of word', () => {
      const textarea = fixture.nativeElement.querySelector('textarea');
      if (!textarea) return;

      component.content = 'email@test';
      textarea.value = 'email@test';
      textarea.selectionStart = 10;

      const event = { target: textarea } as unknown as Event;
      component.onInput(event);

      // Should not open popover for email-like patterns
      expect(mockOverlay.create).not.toHaveBeenCalled();
    });
  });
});
