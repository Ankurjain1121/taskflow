import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RecentItemsService } from './recent-items.service';

const STORAGE_KEY = 'taskflow_recent_items';

describe('RecentItemsService', () => {
  let service: RecentItemsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RecentItemsService],
    });

    service = TestBed.inject(RecentItemsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Drain any fire-and-forget POST requests so httpMock.verify() doesn't fail
    httpMock.match('/api/recent-items').forEach((req) => req.flush({}));
    httpMock.verify();
    localStorage.clear();
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  describe('recordProjectView()', () => {
    it('adds a board item to the items signal', () => {
      service.recordProjectView({
        id: 'board-1',
        name: 'My Board',
        workspaceId: 'ws-1',
        workspaceName: 'My Workspace',
      });

      const items = service.items();
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('board-1');
      expect(items[0].entityType).toBe('project');
      expect(items[0].name).toBe('My Board');
    });

    it('deduplicates: removes the old entry for the same board id before adding the new one', () => {
      service.recordProjectView({
        id: 'board-1',
        name: 'My Board',
        workspaceId: 'ws-1',
      });
      service.recordProjectView({
        id: 'board-2',
        name: 'Other Board',
        workspaceId: 'ws-1',
      });
      service.recordProjectView({
        id: 'board-1',
        name: 'My Board (updated)',
        workspaceId: 'ws-1',
      });

      const items = service.items();
      const board1Entries = items.filter((i) => i.id === 'board-1');
      expect(board1Entries.length).toBe(1);
      // Most recent visit should be first
      expect(items[0].id).toBe('board-1');
      expect(items[0].name).toBe('My Board (updated)');
    });
  });

  describe('recordTaskView()', () => {
    it('adds a task item to the items signal with entityType "task"', () => {
      service.recordTaskView({
        id: 'task-1',
        title: 'Fix the bug',
        boardName: 'My Board',
        workspaceId: 'ws-1',
        workspaceName: 'My Workspace',
        projectId: 'board-1',
      });

      const items = service.items();
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('task-1');
      expect(items[0].entityType).toBe('task');
      expect(items[0].name).toBe('Fix the bug');
    });
  });

  describe('recentBoards computed', () => {
    it('only returns board items', () => {
      service.recordProjectView({
        id: 'board-1',
        name: 'Project',
        workspaceId: 'ws-1',
      });
      service.recordTaskView({
        id: 'task-1',
        title: 'Task',
        boardName: 'Project',
        workspaceId: 'ws-1',
        projectId: 'board-1',
      });

      expect(service.recentBoards().length).toBe(1);
      expect(service.recentBoards()[0].entityType).toBe('project');
    });
  });

  describe('recentTasks computed', () => {
    it('only returns task items', () => {
      service.recordProjectView({
        id: 'board-1',
        name: 'Project',
        workspaceId: 'ws-1',
      });
      service.recordTaskView({
        id: 'task-1',
        title: 'Task',
        boardName: 'Project',
        workspaceId: 'ws-1',
        projectId: 'board-1',
      });

      expect(service.recentTasks().length).toBe(1);
      expect(service.recentTasks()[0].entityType).toBe('task');
    });
  });

  describe('items cap', () => {
    it('keeps only the 10 most recent items when more than MAX_ITEMS are added', () => {
      for (let i = 1; i <= 11; i++) {
        service.recordProjectView({
          id: `board-${i}`,
          name: `Board ${i}`,
          workspaceId: 'ws-1',
        });
      }

      expect(service.items().length).toBe(10);
      // The most recently added (board-11) should be first
      expect(service.items()[0].id).toBe('board-11');
      // The oldest (board-1) should have been dropped
      expect(service.items().find((i) => i.id === 'board-1')).toBeUndefined();
    });
  });
});
