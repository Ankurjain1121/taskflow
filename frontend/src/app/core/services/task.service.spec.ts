import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  TaskService,
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  MoveTaskRequest,
  Label,
  TaskListItem,
  CalendarTask,
  GanttTask,
  BulkUpdateRequest,
  BulkDeleteRequest,
} from './task.service';

const MOCK_TASK: Task = {
  id: 'task-1',
  column_id: 'col-1',
  title: 'Test Task',
  description: 'A test task',
  priority: 'medium',
  position: '1000',
  milestone_id: null,
  assignee_id: null,
  due_date: null,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_TASKS: Task[] = [
  MOCK_TASK,
  { ...MOCK_TASK, id: 'task-2', title: 'Second Task', position: '2000' },
];

describe('TaskService', () => {
  let service: TaskService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TaskService],
    });
    service = TestBed.inject(TaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listTasks()', () => {
    it('should GET /api/columns/:columnId/tasks', () => {
      service.listTasks('col-1').subscribe((tasks) => {
        expect(tasks).toEqual(MOCK_TASKS);
      });

      const req = httpMock.expectOne('/api/columns/col-1/tasks');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TASKS);
    });
  });

  describe('getTask()', () => {
    it('should GET /api/tasks/:taskId', () => {
      service.getTask('task-1').subscribe((task) => {
        expect(task).toEqual(MOCK_TASK);
      });

      const req = httpMock.expectOne('/api/tasks/task-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TASK);
    });
  });

  describe('createTask()', () => {
    it('should POST to /api/boards/:boardId/tasks with body', () => {
      const createReq: CreateTaskRequest = {
        title: 'New Task',
        description: 'Description',
        priority: 'high',
        column_id: 'col-1',
      };

      service.createTask('board-1', createReq).subscribe((task) => {
        expect(task).toEqual(MOCK_TASK);
      });

      const req = httpMock.expectOne('/api/boards/board-1/tasks');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_TASK);
    });
  });

  describe('updateTask()', () => {
    it('should PATCH /api/tasks/:taskId with body', () => {
      const updateReq: UpdateTaskRequest = {
        title: 'Updated Title',
        priority: 'urgent',
      };

      service.updateTask('task-1', updateReq).subscribe((task) => {
        expect(task).toEqual(MOCK_TASK);
      });

      const req = httpMock.expectOne('/api/tasks/task-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_TASK);
    });
  });

  describe('moveTask()', () => {
    it('should PATCH /api/tasks/:taskId/move with column_id and position', () => {
      const moveReq: MoveTaskRequest = {
        column_id: 'col-2',
        position: '5000',
      };

      service.moveTask('task-1', moveReq).subscribe((task) => {
        expect(task).toEqual(MOCK_TASK);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/move');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(moveReq);
      req.flush(MOCK_TASK);
    });
  });

  describe('deleteTask()', () => {
    it('should DELETE /api/tasks/:taskId', () => {
      service.deleteTask('task-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('assignUser()', () => {
    it('should POST /api/tasks/:taskId/assignees with user_id', () => {
      service.assignUser('task-1', 'user-42').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/assignees');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ user_id: 'user-42' });
      req.flush(null);
    });
  });

  describe('unassignUser()', () => {
    it('should DELETE /api/tasks/:taskId/assignees/:userId', () => {
      service.unassignUser('task-1', 'user-42').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/assignees/user-42');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('addLabel()', () => {
    it('should POST /api/tasks/:taskId/labels/:labelId', () => {
      service.addLabel('task-1', 'label-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/labels/label-1');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });
  });

  describe('removeLabel()', () => {
    it('should DELETE /api/tasks/:taskId/labels/:labelId', () => {
      service.removeLabel('task-1', 'label-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/labels/label-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getLabels()', () => {
    it('should GET /api/tasks/:taskId/labels', () => {
      const mockLabels: Label[] = [
        {
          id: 'label-1',
          workspace_id: 'ws-1',
          name: 'Bug',
          color: '#ff0000',
          created_at: '2026-01-01T00:00:00Z',
        },
      ];

      service.getLabels('task-1').subscribe((labels) => {
        expect(labels).toEqual(mockLabels);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/labels');
      expect(req.request.method).toBe('GET');
      req.flush(mockLabels);
    });
  });

  describe('listByBoard()', () => {
    it('should GET /api/boards/:boardId/tasks and extract tasks map', () => {
      const taskMap: Record<string, Task[]> = {
        'col-1': [MOCK_TASK],
        'col-2': [],
      };

      service.listByBoard('board-1').subscribe((result) => {
        expect(result).toEqual(taskMap);
      });

      const req = httpMock.expectOne('/api/boards/board-1/tasks');
      expect(req.request.method).toBe('GET');
      req.flush({ tasks: taskMap });
    });
  });

  describe('listFlat()', () => {
    it('should GET /api/boards/:boardId/tasks/list', () => {
      const mockItems: TaskListItem[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: null,
          priority: 'medium',
          due_date: null,
          column_id: 'col-1',
          column_name: 'To Do',
          position: '1000',
          created_by_id: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      service.listFlat('board-1').subscribe((items) => {
        expect(items).toEqual(mockItems);
      });

      const req = httpMock.expectOne('/api/boards/board-1/tasks/list');
      expect(req.request.method).toBe('GET');
      req.flush(mockItems);
    });
  });

  describe('listCalendarTasks()', () => {
    it('should GET /api/boards/:boardId/tasks/calendar with start and end params', () => {
      const mockCalendarTasks: CalendarTask[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          priority: 'medium',
          due_date: '2026-02-20',
          start_date: '2026-02-18',
          column_id: 'col-1',
          column_name: 'To Do',
          is_done: false,
          milestone_id: null,
        },
      ];

      service
        .listCalendarTasks('board-1', '2026-02-01', '2026-02-28')
        .subscribe((tasks) => {
          expect(tasks).toEqual(mockCalendarTasks);
        });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/boards/board-1/tasks/calendar',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('start')).toBe('2026-02-01');
      expect(req.request.params.get('end')).toBe('2026-02-28');
      req.flush(mockCalendarTasks);
    });
  });

  describe('listGanttTasks()', () => {
    it('should GET /api/boards/:boardId/tasks/gantt', () => {
      const mockGanttTasks: GanttTask[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          priority: 'high',
          start_date: '2026-02-01',
          due_date: '2026-02-15',
          column_id: 'col-1',
          column_name: 'In Progress',
          is_done: false,
          milestone_id: null,
        },
      ];

      service.listGanttTasks('board-1').subscribe((tasks) => {
        expect(tasks).toEqual(mockGanttTasks);
      });

      const req = httpMock.expectOne('/api/boards/board-1/tasks/gantt');
      expect(req.request.method).toBe('GET');
      req.flush(mockGanttTasks);
    });
  });

  describe('bulkUpdate()', () => {
    it('should POST /api/boards/:boardId/tasks/bulk-update', () => {
      const bulkReq: BulkUpdateRequest = {
        task_ids: ['task-1', 'task-2'],
        priority: 'high',
      };

      service.bulkUpdate('board-1', bulkReq).subscribe((result) => {
        expect(result).toEqual({ updated: 2 });
      });

      const req = httpMock.expectOne('/api/boards/board-1/tasks/bulk-update');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(bulkReq);
      req.flush({ updated: 2 });
    });
  });

  describe('bulkDelete()', () => {
    it('should POST /api/boards/:boardId/tasks/bulk-delete', () => {
      const bulkReq: BulkDeleteRequest = {
        task_ids: ['task-1', 'task-2'],
      };

      service.bulkDelete('board-1', bulkReq).subscribe((result) => {
        expect(result).toEqual({ deleted: 2 });
      });

      const req = httpMock.expectOne('/api/boards/board-1/tasks/bulk-delete');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(bulkReq);
      req.flush({ deleted: 2 });
    });
  });

  describe('updateTask() conflict handling', () => {
    it('should return ConflictError with serverTask on 409', () => {
      let error: any;
      const serverTask = { ...MOCK_TASK, title: 'Server Version' };

      service.updateTask('task-1', { title: 'My Version' }).subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-1');
      req.flush(
        { current_task: serverTask },
        { status: 409, statusText: 'Conflict' },
      );

      expect(error).toBeTruthy();
      expect(error.status).toBe(409);
      expect(error.serverTask).toEqual(serverTask);
    });

    it('should pass through non-409 errors normally', () => {
      let error: any;

      service.updateTask('task-1', { title: 'Updated' }).subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-1');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
      expect(error.serverTask).toBeUndefined();
    });
  });

  describe('duplicateTask()', () => {
    it('should POST /api/tasks/:taskId/duplicate', () => {
      service.duplicateTask('task-1').subscribe((task) => {
        expect(task).toEqual(MOCK_TASK);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/duplicate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(MOCK_TASK);
    });
  });

  describe('watchers', () => {
    it('addWatcher should POST /api/tasks/:taskId/watchers', () => {
      service.addWatcher('task-1', 'user-42').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/watchers');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ user_id: 'user-42' });
      req.flush(null);
    });

    it('removeWatcher should DELETE /api/tasks/:taskId/watchers/:userId', () => {
      service.removeWatcher('task-1', 'user-42').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/watchers/user-42');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('reminders', () => {
    it('setReminder should POST /api/tasks/:taskId/reminders', () => {
      service.setReminder('task-1', 30).subscribe((result) => {
        expect(result.success).toBe(true);
        expect(result.id).toBe('rem-1');
      });

      const req = httpMock.expectOne('/api/tasks/task-1/reminders');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ remind_before_minutes: 30 });
      req.flush({ success: true, id: 'rem-1' });
    });

    it('listReminders should GET /api/tasks/:taskId/reminders', () => {
      const mockReminders = [
        {
          id: 'rem-1',
          task_id: 'task-1',
          remind_before_minutes: 30,
          is_sent: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      ];

      service.listReminders('task-1').subscribe((reminders) => {
        expect(reminders).toEqual(mockReminders);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/reminders');
      expect(req.request.method).toBe('GET');
      req.flush(mockReminders);
    });

    it('removeReminder should DELETE /api/tasks/:taskId/reminders/:reminderId', () => {
      service.removeReminder('task-1', 'rem-1').subscribe();

      const req = httpMock.expectOne('/api/tasks/task-1/reminders/rem-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors', () => {
      let error: any;
      service.getTask('nonexistent').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/nonexistent');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });

    it('should handle 403 Forbidden', () => {
      let error: any;
      service.deleteTask('task-1').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/tasks/task-1');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
