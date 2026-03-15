import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { MyTasksComponent } from './my-tasks.component';
import { MyTasksService } from '../../../core/services/my-tasks.service';
import { ProjectService } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';

describe('MyTasksComponent', () => {
  let component: MyTasksComponent;
  let fixture: ComponentFixture<MyTasksComponent>;
  let mockMyTasksService: any;
  let mockWsService: any;

  const mockTasks = {
    items: [
      {
        id: 't-1',
        title: 'Task 1',
        board_id: 'b-1',
        board_name: 'Board 1',
        workspace_id: 'ws-1',
        priority: 'medium',
        due_date: null,
        column_name: 'Todo',
      },
      {
        id: 't-2',
        title: 'Task 2',
        board_id: 'b-2',
        board_name: 'Board 2',
        workspace_id: 'ws-1',
        priority: 'high',
        due_date: '2026-03-01',
        column_name: 'In Progress',
      },
    ],
    next_cursor: null,
  };

  const mockSummary = {
    total: 10,
    overdue: 2,
    due_today: 3,
    no_due_date: 5,
  };

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mockMyTasksService = {
      getMyTasks: vi.fn().mockReturnValue(of(mockTasks)),
      getMyTasksSummary: vi.fn().mockReturnValue(of(mockSummary)),
    };

    const mockProjectService = {
      listBoards: vi.fn().mockReturnValue(of([])),
    };

    const mockAuthService = {
      currentUser: signal({
        id: 'u-1',
        name: 'Alice',
        email: 'alice@test.com',
        avatar_url: null,
        role: 'Member' as const,
        tenant_id: 't-1',
        onboarding_completed: true,
      }),
    };

    mockWsService = {
      connect: vi.fn(),
      send: vi.fn(),
      messages$: new Subject(),
    };

    await TestBed.configureTestingModule({
      imports: [MyTasksComponent],
      providers: [
        provideRouter([]),
        { provide: MyTasksService, useValue: mockMyTasksService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: WebSocketService, useValue: mockWsService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MyTasksComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load initial data on init', () => {
    component.ngOnInit();
    expect(mockMyTasksService.getMyTasks).toHaveBeenCalled();
    expect(mockMyTasksService.getMyTasksSummary).toHaveBeenCalled();
    expect(component.tasks().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should handle loadInitialData error', () => {
    mockMyTasksService.getMyTasks.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.loadInitialData();
    expect(component.error()).toContain('Failed to load tasks');
    expect(component.loading()).toBe(false);
  });

  it('should load more tasks', () => {
    component.ngOnInit();
    component.nextCursor.set('cursor-1');
    component.loading.set(false);
    mockMyTasksService.getMyTasks.mockReturnValue(
      of({
        items: [
          {
            id: 't-3',
            title: 'Task 3',
            board_id: 'b-1',
            board_name: 'Board 1',
            workspace_id: 'ws-1',
          },
        ],
        next_cursor: null,
      }),
    );
    component.loadMore();
    expect(component.tasks().length).toBeGreaterThan(0);
  });

  it('should not load more when already loading', () => {
    component.loading.set(true);
    const callCount = mockMyTasksService.getMyTasks.mock.calls.length;
    component.loadMore();
    expect(mockMyTasksService.getMyTasks.mock.calls.length).toBe(callCount);
  });

  it('should not load more when no more items', () => {
    component.nextCursor.set(null);
    component.loading.set(false);
    const callCount = mockMyTasksService.getMyTasks.mock.calls.length;
    component.loadMore();
    expect(mockMyTasksService.getMyTasks.mock.calls.length).toBe(callCount);
  });

  it('should toggle sort order', () => {
    component.sortOrder = 'asc';
    component.toggleSortOrder();
    expect(component.sortOrder).toBe('desc');
    component.toggleSortOrder();
    expect(component.sortOrder).toBe('asc');
  });

  it('should reload on filter change', () => {
    component.onFilterChange();
    expect(mockMyTasksService.getMyTasks).toHaveBeenCalled();
    expect(mockMyTasksService.getMyTasksSummary).toHaveBeenCalled();
  });

  it('should reload on sort change', () => {
    component.onSortChange();
    expect(mockMyTasksService.getMyTasks).toHaveBeenCalled();
  });

  it('should compute hasMore correctly', () => {
    component.nextCursor.set(null);
    expect(component.hasMore()).toBe(false);
    component.nextCursor.set('cursor-1');
    expect(component.hasMore()).toBe(true);
  });

  it('should not throw on destroy', () => {
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
