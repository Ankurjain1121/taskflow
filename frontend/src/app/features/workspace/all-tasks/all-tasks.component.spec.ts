import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AllTasksComponent } from './all-tasks.component';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import { Router } from '@angular/router';

// PrimeNG Select / Table may use ResizeObserver
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

describe('AllTasksComponent', () => {
  let component: AllTasksComponent;
  let fixture: ComponentFixture<AllTasksComponent>;
  let httpTesting: HttpTestingController;
  let mockWsContext: any;
  let router: Router;

  const mockTasks = [
    {
      id: 't-1',
      title: 'Task One',
      priority: 'high',
      status_name: 'In Progress',
      status_color: '#3b82f6',
      due_date: null,
      board_id: 'b-1',
      board_name: 'Sprint Board',
      assignee_name: 'Alice',
      task_number: 42,
      child_count: 0,
      created_at: '2026-01-01',
    },
    {
      id: 't-2',
      title: 'Task Two',
      priority: 'low',
      status_name: null,
      status_color: null,
      due_date: '2026-04-01',
      board_id: 'b-2',
      board_name: 'Backlog',
      assignee_name: null,
      task_number: null,
      child_count: 2,
      created_at: '2026-01-02',
    },
  ];

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

    mockWsContext = {
      activeWorkspaceId: vi.fn().mockReturnValue('ws-1'),
      activeProjects: vi.fn().mockReturnValue([
        { id: 'b-1', name: 'Sprint Board' },
        { id: 'b-2', name: 'Backlog' },
      ]),
    };

    await TestBed.configureTestingModule({
      imports: [AllTasksComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkspaceContextService, useValue: mockWsContext },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AllTasksComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    // Flush the initial request from ngOnInit
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    req.flush({ items: [], next_cursor: null });

    expect(component).toBeTruthy();
  });

  it('should have initial signal values', () => {
    expect(component.tasks()).toEqual([]);
    expect(component.loading()).toBe(false);
    expect(component.nextCursor()).toBeNull();
    expect(component.statusFilter()).toBeNull();
    expect(component.priorityFilter()).toBeNull();
    expect(component.projectFilter()).toBeNull();
  });

  it('should load tasks on init', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ items: mockTasks, next_cursor: null });

    expect(component.tasks().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should not fetch when workspace id is null', () => {
    mockWsContext.activeWorkspaceId.mockReturnValue(null);
    fixture.detectChanges();

    httpTesting.expectNone((r) => r.url.includes('/api/workspace/'));
    expect(component.tasks()).toEqual([]);
  });

  it('should handle load error', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    req.error(new ProgressEvent('error'));

    expect(component.loading()).toBe(false);
  });

  it('should load more with cursor', () => {
    fixture.detectChanges();
    const req1 = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    req1.flush({ items: mockTasks, next_cursor: 'cur-1' });

    expect(component.nextCursor()).toBe('cur-1');

    component.loadMore();

    const req2 = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks') &&
      r.params.get('cursor') === 'cur-1',
    );
    req2.flush({
      items: [
        {
          ...mockTasks[0],
          id: 't-3',
          title: 'Task Three',
        },
      ],
      next_cursor: null,
    });

    expect(component.tasks().length).toBe(3);
    expect(component.nextCursor()).toBeNull();
  });

  it('should pass filters as query params', () => {
    component.statusFilter.set('done');
    component.priorityFilter.set('high');
    component.projectFilter.set('b-1');

    component.loadTasks();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    expect(req.request.params.get('status')).toBe('done');
    expect(req.request.params.get('priority')).toBe('high');
    expect(req.request.params.get('board_id')).toBe('b-1');
    req.flush({ items: [], next_cursor: null });
  });

  it('should compute projectFilterOptions from wsContext', () => {
    const options = component.projectFilterOptions();
    expect(options).toEqual([
      { label: 'Sprint Board', value: 'b-1' },
      { label: 'Backlog', value: 'b-2' },
    ]);
  });

  it('should navigate on openTask', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    req.flush({ items: mockTasks, next_cursor: null });

    component.openTask(mockTasks[0] as any);

    expect(navSpy).toHaveBeenCalledWith(
      ['/workspace', 'ws-1', 'project', 'b-1'],
      { queryParams: { task: 't-1' } },
    );
  });

  it('should not navigate when no workspace id', () => {
    mockWsContext.activeWorkspaceId.mockReturnValue(null);
    const navSpy = vi.spyOn(router, 'navigate');

    component.openTask(mockTasks[0] as any);

    expect(navSpy).not.toHaveBeenCalled();
  });

  it('should openTaskById finding task in list', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    req.flush({ items: mockTasks, next_cursor: null });

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.openTaskById('t-2');

    expect(navSpy).toHaveBeenCalledWith(
      ['/workspace', 'ws-1', 'project', 'b-2'],
      { queryParams: { task: 't-2' } },
    );
  });

  it('should not navigate for unknown taskId in openTaskById', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/api/workspace/ws-1/tasks'),
    );
    req.flush({ items: mockTasks, next_cursor: null });

    const navSpy = vi.spyOn(router, 'navigate');
    component.openTaskById('nonexistent');

    expect(navSpy).not.toHaveBeenCalled();
  });

  describe('utility methods', () => {
    it('getPriorityBg should return a color string', () => {
      const bg = component.getPriorityBg('high');
      expect(typeof bg).toBe('string');
      expect(bg.length).toBeGreaterThan(0);
    });

    it('getPriorityText should return label', () => {
      expect(component.getPriorityText('high')).toBeTruthy();
      expect(component.getPriorityText('low')).toBeTruthy();
    });

    it('getDueDateClass should return string', () => {
      expect(typeof component.getDueDateClass(null)).toBe('string');
      expect(typeof component.getDueDateClass('2026-04-01')).toBe('string');
    });

    it('formatDueDate should return "Today" for today', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(component.formatDueDate(today)).toBe('Today');
    });

    it('formatDueDate should return overdue text for past dates', () => {
      const past = new Date(Date.now() - 3 * 86400000)
        .toISOString()
        .split('T')[0];
      const result = component.formatDueDate(past);
      expect(result).toContain('Overdue');
    });

    it('formatDueDate should return formatted date for future dates', () => {
      const future = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split('T')[0];
      const result = component.formatDueDate(future);
      expect(result).not.toContain('Today');
      expect(result).not.toContain('Overdue');
    });

    it('toCardData should map task fields correctly', () => {
      const card = component.toCardData(mockTasks[0] as any);
      expect(card).toEqual({
        id: 't-1',
        title: 'Task One',
        priority: 'high',
        status: 'In Progress',
        status_color: '#3b82f6',
        due_date: null,
        project_name: 'Sprint Board',
      });
    });
  });

  it('should expose static filter options', () => {
    expect(component.statusFilterOptions.length).toBe(3);
    expect(component.priorityFilterOptions.length).toBe(4);
  });
});
