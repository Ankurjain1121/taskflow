import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TaskDetailSidebarComponent } from './task-detail-sidebar.component';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Task } from '../../core/services/task.service';
import { Column } from '../../core/services/board.service';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    column_id: 'col-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    position: 'a0',
    milestone_id: null,
    assignee_id: null,
    due_date: '2026-03-01',
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    assignees: [
      { id: 'u-1', display_name: 'Alice', avatar_url: null },
    ],
    labels: [
      { id: 'l-1', name: 'Bug', color: '#ef4444' },
    ],
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: 'col-1',
    board_id: 'board-1',
    name: 'In Progress',
    position: 'a0',
    color: '#6366f1',
    status_mapping: null,
    wip_limit: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

@Component({
  standalone: true,
  imports: [TaskDetailSidebarComponent],
  template: `<app-task-detail-sidebar
    [task]="task()"
    [columns]="columns"
    [workspaceId]="workspaceId"
    (priorityChanged)="onPriorityChanged($event)"
    (dueDateChanged)="onDueDateChanged($event)"
    (assigneeAdded)="onAssigneeAdded($event)"
    (assigneeRemoved)="onAssigneeRemoved($event)"
    (labelRemoved)="onLabelRemoved($event)"
    (deleteRequested)="onDeleteRequested()"
  />`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class TestHostComponent {
  task = signal(makeTask());
  columns: Column[] = [makeColumn()];
  workspaceId = 'ws-1';
  onPriorityChanged = vi.fn();
  onDueDateChanged = vi.fn();
  onAssigneeAdded = vi.fn();
  onAssigneeRemoved = vi.fn();
  onLabelRemoved = vi.fn();
  onDeleteRequested = vi.fn();
}

describe('TaskDetailSidebarComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: TaskDetailSidebarComponent;
  let mockWorkspaceService: any;

  beforeEach(async () => {
    mockWorkspaceService = {
      searchMembers: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = fixture.debugElement.children[0].componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute currentColumn from task.column_id', () => {
    expect(component.currentColumn()?.name).toBe('In Progress');
  });

  it('should return null if no columns', () => {
    host.columns = [];
    fixture.detectChanges();
    expect(component.currentColumn()).toBeNull();
  });

  it('should compute dueDateValue as Date object', () => {
    const val = component.dueDateValue();
    expect(val).toBeInstanceOf(Date);
  });

  it('should return null dueDateValue when no due_date', () => {
    host.task.set(makeTask({ due_date: null }));
    fixture.detectChanges();
    expect(component.dueDateValue()).toBeNull();
  });

  it('should start and stop editing', () => {
    expect(component.editingField()).toBeNull();
    component.startEditing('priority');
    expect(component.editingField()).toBe('priority');
    component.stopEditing();
    expect(component.editingField()).toBeNull();
  });

  it('should toggle assignee search', () => {
    expect(component.showAssigneeSearch()).toBe(false);
    component.toggleAssigneeSearch();
    expect(component.showAssigneeSearch()).toBe(true);
    component.toggleAssigneeSearch();
    expect(component.showAssigneeSearch()).toBe(false);
  });

  it('should clear assignee query when search is closed', () => {
    component.showAssigneeSearch.set(true);
    component.assigneeQuery.set('alice');
    component.assigneeResults.set([{ id: 'u-1', name: 'Alice', email: 'alice@test.com' }]);
    component.toggleAssigneeSearch(); // closes
    expect(component.assigneeQuery()).toBe('');
    expect(component.assigneeResults()).toEqual([]);
  });

  it('should search members on assigneeSearch with query >= 2 chars', () => {
    const results = [{ id: 'u-2', name: 'Bob', email: 'bob@test.com' }];
    mockWorkspaceService.searchMembers.mockReturnValue(of(results));
    component.onAssigneeSearch('bo');
    expect(mockWorkspaceService.searchMembers).toHaveBeenCalledWith('ws-1', 'bo');
    expect(component.assigneeResults()).toEqual(results);
  });

  it('should clear results when query is short', () => {
    component.assigneeResults.set([{ id: 'u-1', name: 'A', email: 'a@test.com' }]);
    component.onAssigneeSearch('a');
    expect(component.assigneeResults()).toEqual([]);
  });

  it('should clear results on search error', () => {
    mockWorkspaceService.searchMembers.mockReturnValue(throwError(() => new Error('fail')));
    component.onAssigneeSearch('alice');
    expect(component.assigneeResults()).toEqual([]);
  });

  it('should return priority display label', () => {
    expect(component.getPriorityDisplayLabel('medium')).toBe('Medium');
    expect(component.getPriorityDisplayLabel('urgent')).toBe('Urgent');
  });

  it('should have correct priority options', () => {
    expect(component.priorityOptions.length).toBe(4);
    expect(component.priorityOptions[0].value).toBe('urgent');
  });
});
