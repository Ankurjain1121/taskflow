import { TestBed } from '@angular/core/testing';
import { ProjectFilterService } from './project-filter.service';
import { Task } from '../../../core/services/task.service';
import { TaskFilters } from '../project-toolbar/board-toolbar.component';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  column_id: 'col-1',
  title: 'Default Task',
  description: null,
  priority: 'medium',
  position: '1000',
  milestone_id: null,
  assignee_id: null,
  due_date: null,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  assignees: [],
  labels: [],
  ...overrides,
});

const emptyFilters: TaskFilters = {
  search: '',
  priorities: [],
  assigneeIds: [],
  dueDateStart: null,
  dueDateEnd: null,
  labelIds: [],
  overdue: false,
};

describe('ProjectFilterService', () => {
  let service: ProjectFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectFilterService],
    });
    service = TestBed.inject(ProjectFilterService);
  });

  describe('no filters applied', () => {
    it('should return all tasks when filters are empty', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
      const result = service.filterTasks(tasks, emptyFilters);
      expect(result.length).toBe(2);
    });

    it('should return empty array for empty task list', () => {
      const result = service.filterTasks([], emptyFilters);
      expect(result).toEqual([]);
    });
  });

  describe('search filter', () => {
    it('should filter by title substring (case insensitive)', () => {
      const tasks = [
        makeTask({ id: 't1', title: 'Fix Login Bug' }),
        makeTask({ id: 't2', title: 'Add Dashboard' }),
        makeTask({ id: 't3', title: 'Update login page' }),
      ];
      const filters = { ...emptyFilters, search: 'login' };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(2);
      expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
    });

    it('should return all tasks when search is empty string', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
      const filters = { ...emptyFilters, search: '' };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(2);
    });

    it('should return no tasks when search matches nothing', () => {
      const tasks = [makeTask({ id: 't1', title: 'Build feature' })];
      const filters = { ...emptyFilters, search: 'zzzzz' };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(0);
    });
  });

  describe('priority filter', () => {
    it('should filter by single priority', () => {
      const tasks = [
        makeTask({ id: 't1', priority: 'high' }),
        makeTask({ id: 't2', priority: 'low' }),
        makeTask({ id: 't3', priority: 'high' }),
      ];
      const filters = { ...emptyFilters, priorities: ['high'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(2);
      expect(result.every((t) => t.priority === 'high')).toBe(true);
    });

    it('should filter by multiple priorities', () => {
      const tasks = [
        makeTask({ id: 't1', priority: 'high' }),
        makeTask({ id: 't2', priority: 'low' }),
        makeTask({ id: 't3', priority: 'urgent' }),
        makeTask({ id: 't4', priority: 'medium' }),
      ];
      const filters = { ...emptyFilters, priorities: ['high', 'urgent'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(2);
      expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
    });

    it('should return all tasks when priorities array is empty', () => {
      const tasks = [
        makeTask({ id: 't1', priority: 'high' }),
        makeTask({ id: 't2', priority: 'low' }),
      ];
      const filters = { ...emptyFilters, priorities: [] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(2);
    });
  });

  describe('assignee filter', () => {
    it('should filter by assigned user', () => {
      const tasks = [
        makeTask({
          id: 't1',
          assignees: [
            { id: 'user-1', display_name: 'Alice', avatar_url: null },
          ],
        }),
        makeTask({ id: 't2', assignees: [] }),
        makeTask({
          id: 't3',
          assignees: [
            { id: 'user-2', display_name: 'Bob', avatar_url: null },
          ],
        }),
      ];
      const filters = { ...emptyFilters, assigneeIds: ['user-1'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });

    it('should match if any assignee matches (OR logic)', () => {
      const tasks = [
        makeTask({
          id: 't1',
          assignees: [
            { id: 'user-1', display_name: 'Alice', avatar_url: null },
            { id: 'user-2', display_name: 'Bob', avatar_url: null },
          ],
        }),
      ];
      const filters = { ...emptyFilters, assigneeIds: ['user-2'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
    });

    it('should exclude tasks with undefined assignees', () => {
      const tasks = [makeTask({ id: 't1', assignees: undefined })];
      const filters = { ...emptyFilters, assigneeIds: ['user-1'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(0);
    });
  });

  describe('due date filter', () => {
    it('should filter tasks with due date in range', () => {
      const tasks = [
        makeTask({ id: 't1', due_date: '2026-03-05' }),
        makeTask({ id: 't2', due_date: '2026-03-15' }),
        makeTask({ id: 't3', due_date: '2026-03-25' }),
      ];
      const filters = {
        ...emptyFilters,
        dueDateStart: '2026-03-01',
        dueDateEnd: '2026-03-20',
      };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(2);
      expect(result.map((t) => t.id)).toEqual(['t1', 't2']);
    });

    it('should exclude tasks with no due date when date filter is active', () => {
      const tasks = [
        makeTask({ id: 't1', due_date: null }),
        makeTask({ id: 't2', due_date: '2026-03-10' }),
      ];
      const filters = { ...emptyFilters, dueDateStart: '2026-03-01' };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t2');
    });

    it('should filter by only start date', () => {
      const tasks = [
        makeTask({ id: 't1', due_date: '2026-02-28' }),
        makeTask({ id: 't2', due_date: '2026-03-05' }),
      ];
      const filters = {
        ...emptyFilters,
        dueDateStart: '2026-03-01',
        dueDateEnd: null,
      };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t2');
    });

    it('should filter by only end date', () => {
      const tasks = [
        makeTask({ id: 't1', due_date: '2026-03-05' }),
        makeTask({ id: 't2', due_date: '2026-04-01' }),
      ];
      const filters = {
        ...emptyFilters,
        dueDateStart: null,
        dueDateEnd: '2026-03-15',
      };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });
  });

  describe('label filter', () => {
    it('should filter by label', () => {
      const tasks = [
        makeTask({
          id: 't1',
          labels: [
            {
              id: 'lbl-1',
              name: 'Bug',
              color: '#f00',
              workspace_id: 'ws-1',
              created_at: '',
            },
          ],
        }),
        makeTask({ id: 't2', labels: [] }),
      ];
      const filters = { ...emptyFilters, labelIds: ['lbl-1'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });

    it('should match any label (OR logic)', () => {
      const tasks = [
        makeTask({
          id: 't1',
          labels: [
            {
              id: 'lbl-1',
              name: 'Bug',
              color: '#f00',
              workspace_id: 'ws-1',
              created_at: '',
            },
          ],
        }),
        makeTask({
          id: 't2',
          labels: [
            {
              id: 'lbl-2',
              name: 'Feature',
              color: '#0f0',
              workspace_id: 'ws-1',
              created_at: '',
            },
          ],
        }),
      ];
      const filters = { ...emptyFilters, labelIds: ['lbl-1', 'lbl-3'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });

    it('should handle tasks with undefined labels', () => {
      const tasks = [makeTask({ id: 't1', labels: undefined })];
      const filters = { ...emptyFilters, labelIds: ['lbl-1'] };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(0);
    });
  });

  describe('overdue filter', () => {
    it('should filter to only overdue tasks', () => {
      const pastDate = '2020-01-01';
      const futureDate = '2030-12-31';
      const tasks = [
        makeTask({ id: 't1', due_date: pastDate }),
        makeTask({ id: 't2', due_date: futureDate }),
        makeTask({ id: 't3', due_date: null }),
      ];
      const filters = { ...emptyFilters, overdue: true };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });

    it('should exclude tasks with no due date from overdue filter', () => {
      const tasks = [makeTask({ id: 't1', due_date: null })];
      const filters = { ...emptyFilters, overdue: true };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(0);
    });

    it('should not filter when overdue is false', () => {
      const tasks = [
        makeTask({ id: 't1', due_date: '2020-01-01' }),
        makeTask({ id: 't2', due_date: '2030-12-31' }),
      ];
      const filters = { ...emptyFilters, overdue: false };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(2);
    });
  });

  describe('combined filters', () => {
    it('should apply search + priority together (AND logic)', () => {
      const tasks = [
        makeTask({ id: 't1', title: 'Fix login bug', priority: 'high' }),
        makeTask({ id: 't2', title: 'Fix logout bug', priority: 'low' }),
        makeTask({ id: 't3', title: 'Add dashboard', priority: 'high' }),
      ];
      const filters = {
        ...emptyFilters,
        search: 'Fix',
        priorities: ['high'],
      };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });

    it('should apply all filters simultaneously', () => {
      const tasks = [
        makeTask({
          id: 't1',
          title: 'Urgent fix',
          priority: 'urgent',
          due_date: '2020-01-01',
          assignees: [
            { id: 'user-1', display_name: 'Alice', avatar_url: null },
          ],
          labels: [
            {
              id: 'lbl-1',
              name: 'Bug',
              color: '#f00',
              workspace_id: 'ws-1',
              created_at: '',
            },
          ],
        }),
        makeTask({
          id: 't2',
          title: 'Normal task',
          priority: 'medium',
          due_date: '2030-12-31',
        }),
      ];
      const filters: TaskFilters = {
        search: 'Urgent',
        priorities: ['urgent'],
        assigneeIds: ['user-1'],
        dueDateStart: null,
        dueDateEnd: null,
        labelIds: ['lbl-1'],
        overdue: true,
      };
      const result = service.filterTasks(tasks, filters);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });
  });
});
