import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MessageService } from 'primeng/api';
import { ConflictNotificationService } from './conflict-notification.service';

describe('ConflictNotificationService', () => {
  let service: ConflictNotificationService;
  let messageService: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    messageService = { add: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ConflictNotificationService,
        { provide: MessageService, useValue: messageService },
      ],
    });

    service = TestBed.inject(ConflictNotificationService);
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  describe('registerEdit()', () => {
    it('tracks the edit for the given taskId and fieldName', () => {
      service.registerEdit('task-1', 'title');
      // No direct getter, but checkConflict reveals tracked state
      service.checkConflict('task-1', ['title'], 'Alice');
      expect(messageService.add).toHaveBeenCalledOnce();
    });
  });

  describe('unregisterEdit()', () => {
    it('removes the tracked edit for the given taskId and fieldName', () => {
      service.registerEdit('task-1', 'title');
      service.unregisterEdit('task-1', 'title');
      service.checkConflict('task-1', ['title'], 'Alice');
      expect(messageService.add).not.toHaveBeenCalled();
    });

    it('removes the taskId entry when the last field is removed', () => {
      service.registerEdit('task-1', 'title');
      service.registerEdit('task-1', 'description');
      service.unregisterEdit('task-1', 'title');
      service.unregisterEdit('task-1', 'description');
      // Entry fully removed — no conflict even with matching field
      service.checkConflict('task-1', ['title'], 'Alice');
      expect(messageService.add).not.toHaveBeenCalled();
    });
  });

  describe('clearEdits()', () => {
    it('removes all fields for the given task', () => {
      service.registerEdit('task-1', 'title');
      service.registerEdit('task-1', 'description');
      service.clearEdits('task-1');
      service.checkConflict('task-1', ['title', 'description'], 'Alice');
      expect(messageService.add).not.toHaveBeenCalled();
    });
  });

  describe('checkConflict()', () => {
    it('does nothing when there are no active edits for the task', () => {
      service.checkConflict('task-99', ['title'], 'Alice');
      expect(messageService.add).not.toHaveBeenCalled();
    });

    it('does nothing when the changed fields do not overlap with active edits', () => {
      service.registerEdit('task-1', 'title');
      service.checkConflict('task-1', ['description', 'assignee'], 'Alice');
      expect(messageService.add).not.toHaveBeenCalled();
    });

    it('calls messageService.add with warn severity when a field conflicts', () => {
      service.registerEdit('task-1', 'title');
      service.checkConflict('task-1', ['title'], 'Alice');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' }),
      );
    });

    it('includes the conflicting field names in the detail message', () => {
      service.registerEdit('task-1', 'title');
      service.checkConflict('task-1', ['title'], 'Alice');
      const call = messageService.add.mock.calls[0][0] as Record<
        string,
        string
      >;
      expect(call.detail).toContain('title');
      expect(call.detail).toContain('Alice');
    });

    it('handles multiple conflicting fields', () => {
      service.registerEdit('task-1', 'title');
      service.registerEdit('task-1', 'description');
      service.checkConflict(
        'task-1',
        ['title', 'description', 'assignee'],
        'Bob',
      );
      expect(messageService.add).toHaveBeenCalledOnce();
      const call = messageService.add.mock.calls[0][0] as Record<
        string,
        string
      >;
      expect(call.detail).toContain('title');
      expect(call.detail).toContain('description');
      // Non-conflicting field must not appear
      expect(call.detail).not.toContain('assignee');
    });
  });
});
