import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuditLogComponent } from './audit-log.component';
import {
  WorkspaceService,
  AuditLogEntry,
} from '../../../core/services/workspace.service';

describe('AuditLogComponent', () => {
  let component: AuditLogComponent;
  let fixture: ComponentFixture<AuditLogComponent>;
  let mockWorkspaceService: any;

  const mockEntries: AuditLogEntry[] = [
    {
      id: 'al-1',
      workspace_id: 'ws-1',
      user_id: 'u-1',
      user_name: 'Alice Smith',
      action: 'create_task',
      entity_type: 'task',
      entity_id: 't-1',
      metadata: { title: 'New Task' },
      created_at: new Date().toISOString(),
    },
    {
      id: 'al-2',
      workspace_id: 'ws-1',
      user_id: 'u-2',
      user_name: 'Bob',
      action: 'delete_board',
      entity_type: 'board',
      entity_id: 'b-1',
      metadata: null as any,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  beforeEach(async () => {
    mockWorkspaceService = {
      listAuditLog: vi.fn().mockReturnValue(
        of({ items: mockEntries, next_cursor: null }),
      ),
      listAuditActions: vi.fn().mockReturnValue(
        of({ actions: ['create_task', 'delete_board', 'update_task'] }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial signal values', () => {
    expect(component.entries()).toEqual([]);
    expect(component.actions()).toEqual([]);
    expect(component.loading()).toBe(true);
    expect(component.loadingMore()).toBe(false);
    expect(component.nextCursor()).toBeNull();
    expect(component.actionFilter).toBe('');
    expect(component.entityFilter).toBe('');
  });

  it('should load log and actions on init', () => {
    fixture.detectChanges();

    expect(mockWorkspaceService.listAuditLog).toHaveBeenCalledWith('ws-1', {
      page_size: 25,
      action: undefined,
      entity_type: undefined,
    });
    expect(mockWorkspaceService.listAuditActions).toHaveBeenCalledWith('ws-1');
    expect(component.entries()).toEqual(mockEntries);
    expect(component.actions()).toEqual([
      'create_task',
      'delete_board',
      'update_task',
    ]);
    expect(component.loading()).toBe(false);
  });

  it('should pass filters when loading log', () => {
    component.actionFilter = 'create_task';
    component.entityFilter = 'task';

    component.loadLog();

    expect(mockWorkspaceService.listAuditLog).toHaveBeenCalledWith('ws-1', {
      page_size: 25,
      action: 'create_task',
      entity_type: 'task',
    });
  });

  it('should handle load log error', () => {
    mockWorkspaceService.listAuditLog.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
  });

  it('should load more entries with cursor', () => {
    mockWorkspaceService.listAuditLog
      .mockReturnValueOnce(of({ items: mockEntries, next_cursor: 'cur-1' }))
      .mockReturnValueOnce(
        of({
          items: [
            {
              id: 'al-3',
              workspace_id: 'ws-1',
              user_id: 'u-1',
              user_name: 'Alice Smith',
              action: 'update_task',
              entity_type: 'task',
              entity_id: 't-2',
              metadata: null,
              created_at: new Date(Date.now() - 7200000).toISOString(),
            },
          ],
          next_cursor: null,
        }),
      );

    fixture.detectChanges();
    expect(component.nextCursor()).toBe('cur-1');

    component.loadMore();

    expect(component.entries().length).toBe(3);
    expect(component.nextCursor()).toBeNull();
    expect(component.loadingMore()).toBe(false);
  });

  it('should not load more when no cursor', () => {
    fixture.detectChanges();
    component.loadMore();

    // Only called once in ngOnInit
    expect(mockWorkspaceService.listAuditLog).toHaveBeenCalledTimes(1);
  });

  it('should handle loadMore error', () => {
    mockWorkspaceService.listAuditLog
      .mockReturnValueOnce(of({ items: mockEntries, next_cursor: 'cur-1' }))
      .mockReturnValueOnce(throwError(() => new Error('fail')));

    fixture.detectChanges();
    component.loadMore();

    expect(component.loadingMore()).toBe(false);
  });

  describe('formatAction', () => {
    it('should replace underscores and capitalize', () => {
      expect(component.formatAction('create_task')).toBe('Create task');
      expect(component.formatAction('delete_board')).toBe('Delete board');
    });

    it('should handle single word', () => {
      expect(component.formatAction('archive')).toBe('Archive');
    });
  });

  describe('describeAction', () => {
    it('should produce human-readable description', () => {
      const entry = mockEntries[0];
      expect(component.describeAction(entry)).toBe('create task a task');
    });
  });

  describe('getInitials', () => {
    it('should return initials from full name', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
    });

    it('should return single initial for single name', () => {
      expect(component.getInitials('Bob')).toBe('B');
    });

    it('should return ? for empty name', () => {
      expect(component.getInitials('')).toBe('?');
    });

    it('should truncate to 2 characters', () => {
      expect(component.getInitials('Alice Bob Charlie')).toBe('AB');
    });
  });

  describe('summarizeMetadata', () => {
    it('should summarize up to 3 keys', () => {
      const result = component.summarizeMetadata({ title: 'Task', status: 'done' });
      expect(result).toContain('title: Task');
      expect(result).toContain('status: done');
    });

    it('should return empty string for empty object', () => {
      expect(component.summarizeMetadata({})).toBe('');
    });

    it('should truncate to 3 keys', () => {
      const result = component.summarizeMetadata({
        a: 1,
        b: 2,
        c: 3,
        d: 4,
      });
      expect(result.split(',').length).toBe(3);
    });
  });

  describe('formatTimeAgo', () => {
    it('should return "just now" for recent time', () => {
      expect(component.formatTimeAgo(new Date().toISOString())).toBe('just now');
    });

    it('should return minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(component.formatTimeAgo(fiveMinAgo)).toBe('5m ago');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      expect(component.formatTimeAgo(twoHoursAgo)).toBe('2h ago');
    });

    it('should return days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      expect(component.formatTimeAgo(threeDaysAgo)).toBe('3d ago');
    });

    it('should return formatted date for old entries', () => {
      const oldDate = new Date('2025-06-15').toISOString();
      const result = component.formatTimeAgo(oldDate);
      expect(result).toContain('Jun');
      expect(result).toContain('15');
    });
  });
});
