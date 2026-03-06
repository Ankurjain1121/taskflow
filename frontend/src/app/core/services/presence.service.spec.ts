import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PresenceService, TaskLockInfo } from './presence.service';
import { WebSocketService } from './websocket.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let wsSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    wsSend = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        PresenceService,
        { provide: WebSocketService, useValue: { send: wsSend } },
      ],
    });

    service = TestBed.inject(PresenceService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates with empty boardViewers and taskLocks', () => {
    expect(service).toBeTruthy();
    expect(service.boardViewers()).toEqual([]);
    expect(service.taskLocks().size).toBe(0);
  });

  describe('joinBoard()', () => {
    it('calls wsService.send with join_board and the board_id', () => {
      service.joinBoard('board-1');
      expect(wsSend).toHaveBeenCalledWith('join_board', {
        board_id: 'board-1',
      });
    });

    it('calls leaveBoard first when already on another board', () => {
      service.joinBoard('board-1');
      wsSend.mockClear();

      service.joinBoard('board-2');

      // First call should be leave_board for the old board
      expect(wsSend).toHaveBeenNthCalledWith(1, 'leave_board', {
        board_id: 'board-1',
      });
      // Second call should be join_board for the new board
      expect(wsSend).toHaveBeenNthCalledWith(2, 'join_board', {
        board_id: 'board-2',
      });
    });
  });

  describe('leaveBoard()', () => {
    it('calls wsService.send with leave_board and clears viewers', () => {
      service.joinBoard('board-1');
      service.updateViewers(['user-1', 'user-2']);
      wsSend.mockClear();

      service.leaveBoard();

      expect(wsSend).toHaveBeenCalledWith('leave_board', {
        board_id: 'board-1',
      });
      expect(service.boardViewers()).toEqual([]);
    });
  });

  describe('lockTask()', () => {
    it('calls wsService.send with lock_task when on a board', () => {
      service.joinBoard('board-1');
      wsSend.mockClear();

      service.lockTask('task-42');

      expect(wsSend).toHaveBeenCalledWith('lock_task', {
        board_id: 'board-1',
        task_id: 'task-42',
      });
    });

    it('does nothing if no current board', () => {
      service.lockTask('task-42');
      expect(wsSend).not.toHaveBeenCalledWith('lock_task', expect.anything());
    });
  });

  describe('unlockTask()', () => {
    it('calls wsService.send with unlock_task when on a board', () => {
      service.joinBoard('board-1');
      wsSend.mockClear();

      service.unlockTask('task-42');

      expect(wsSend).toHaveBeenCalledWith('unlock_task', {
        board_id: 'board-1',
        task_id: 'task-42',
      });
    });

    it('does nothing if no current board', () => {
      service.unlockTask('task-42');
      expect(wsSend).not.toHaveBeenCalledWith('unlock_task', expect.anything());
    });
  });

  describe('updateViewers()', () => {
    it('sets the boardViewers signal', () => {
      service.updateViewers(['user-1', 'user-2', 'user-3']);
      expect(service.boardViewers()).toEqual(['user-1', 'user-2', 'user-3']);
    });
  });

  describe('setTaskLock()', () => {
    it('adds the lock info to the taskLocks map', () => {
      const lockInfo: TaskLockInfo = { user_id: 'user-1', user_name: 'Alice' };
      service.setTaskLock('task-10', lockInfo);
      expect(service.taskLocks().get('task-10')).toEqual(lockInfo);
    });
  });

  describe('removeTaskLock()', () => {
    it('removes the lock entry from the taskLocks map', () => {
      service.setTaskLock('task-10', { user_id: 'user-1', user_name: 'Alice' });
      service.removeTaskLock('task-10');
      expect(service.taskLocks().has('task-10')).toBe(false);
    });
  });

  describe('updateViewerName()', () => {
    it('adds the userId->name mapping to the viewerNames map', () => {
      service.updateViewerName('user-1', 'Alice');
      expect(service.viewerNames().get('user-1')).toBe('Alice');
    });
  });
});
