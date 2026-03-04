import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TaskFilterBarComponent } from './task-filter-bar.component';

@Component({
  standalone: true,
  imports: [TaskFilterBarComponent],
  template: `<app-task-filter-bar
    [projectId]="'proj-1'"
    [members]="members"
    (filtersChanged)="onFilters($event)"
  />`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class TestHostComponent {
  members = [
    { name: 'Alice', user_id: 'u-1' },
    { name: 'Bob', user_id: 'u-2' },
  ];
  onFilters = vi.fn();
}

describe('TaskFilterBarComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: TaskFilterBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
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

  it('should have priority options', () => {
    expect(component.priorityOptions.length).toBe(4);
  });

  it('should have due date options', () => {
    expect(component.dueDateOptions.length).toBe(3);
  });

  it('should compute assignee options from members', () => {
    const options = component.assigneeOptions();
    expect(options.length).toBe(2);
    expect(options[0].label).toBe('Alice');
    expect(options[0].value).toBe('u-1');
  });

  it('should detect active filters', () => {
    expect(component.hasActiveFilters()).toBe(false);

    component.selectedPriority.set('high');
    expect(component.hasActiveFilters()).toBe(true);
  });

  it('should clear all filters', () => {
    component.searchText.set('test');
    component.selectedPriority.set('high');
    component.selectedAssignee.set('u-1');
    component.selectedDueDateFilter.set('overdue');

    component.clearAll();
    expect(component.searchText()).toBe('');
    expect(component.selectedPriority()).toBeNull();
    expect(component.selectedAssignee()).toBeNull();
    expect(component.selectedDueDateFilter()).toBeNull();
  });

  it('should emit filters on filter change with priority', () => {
    component.selectedPriority.set('high');
    component.onFilterChange();
    expect(host.onFilters).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'high' }),
    );
  });

  it('should emit filters on filter change with assignee', () => {
    component.selectedAssignee.set('u-1');
    component.onFilterChange();
    expect(host.onFilters).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_id: 'u-1' }),
    );
  });

  it('should emit filters with search text', () => {
    component.searchText.set('bug fix');
    component.onFilterChange();
    expect(host.onFilters).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'bug fix' }),
    );
  });

  it('should handle due date filter for overdue', () => {
    component.selectedDueDateFilter.set('overdue');
    component.onFilterChange();
    expect(host.onFilters).toHaveBeenCalledWith(
      expect.objectContaining({ due_before: expect.any(String) }),
    );
  });

  it('should handle due date filter for today', () => {
    component.selectedDueDateFilter.set('today');
    component.onFilterChange();
    const call =
      host.onFilters.mock.calls[host.onFilters.mock.calls.length - 1][0];
    expect(call.due_after).toBeDefined();
    expect(call.due_before).toBeDefined();
  });

  it('should handle due date filter for week', () => {
    component.selectedDueDateFilter.set('week');
    component.onFilterChange();
    const call =
      host.onFilters.mock.calls[host.onFilters.mock.calls.length - 1][0];
    expect(call.due_after).toBeDefined();
    expect(call.due_before).toBeDefined();
  });

  it('should debounce search input', fakeAsync(() => {
    component.onSearchChange('hello');
    tick(300);
    expect(component.searchText()).toBe('hello');
  }));

  it('should update due date filter via onDueDateFilterChange', () => {
    component.onDueDateFilterChange('today');
    expect(component.selectedDueDateFilter()).toBe('today');
  });

  it('should clear search', () => {
    component.searchText.set('test');
    component.clearSearch();
    expect(component.searchText()).toBe('');
  });
});
