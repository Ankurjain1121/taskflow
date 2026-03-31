import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';

import { MyWorkBoardComponent } from './my-work-board.component';
import {
  MyWorkBoardService,
  PersonalBoardItem,
  PersonalBoardResponse,
} from '../../core/services/my-work-board.service';

function makeBoardItem(overrides: Partial<PersonalBoardItem> = {}): PersonalBoardItem {
  return {
    id: 'item-1',
    task_id: 'task-1',
    column_name: 'backlog',
    position: 0,
    task_title: 'Test Task',
    task_priority: 'medium',
    task_due_date: null,
    project_id: 'proj-1',
    project_name: 'Project Alpha',
    status_name: 'To Do',
    status_type: null,
    ...overrides,
  };
}

const MOCK_BOARD: PersonalBoardResponse = {
  backlog: [makeBoardItem({ id: 'item-1', task_id: 'task-1', task_title: 'Backlog Task' })],
  today: [makeBoardItem({ id: 'item-2', task_id: 'task-2', task_title: 'Today Task', column_name: 'today' })],
  in_progress: [],
  done: [makeBoardItem({ id: 'item-3', task_id: 'task-3', task_title: 'Done Task', column_name: 'done' })],
};

describe('MyWorkBoardComponent', () => {
  let component: MyWorkBoardComponent;
  let fixture: ComponentFixture<MyWorkBoardComponent>;
  let router: Router;

  const mockBoardService = {
    getBoard: vi.fn().mockReturnValue(of(MOCK_BOARD)),
    moveTask: vi.fn().mockReturnValue(of({ message: 'ok' })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockBoardService.getBoard.mockReturnValue(of(MOCK_BOARD));
    mockBoardService.moveTask.mockReturnValue(of({ message: 'ok' }));

    await TestBed.configureTestingModule({
      imports: [MyWorkBoardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MyWorkBoardService, useValue: mockBoardService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(MyWorkBoardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start with loading false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should start with null board', () => {
      expect(component.board()).toBeNull();
    });

    it('should have 4 columns defined', () => {
      expect(component.columns).toHaveLength(4);
      expect(component.columns.map((c) => c.key)).toEqual([
        'backlog', 'today', 'in_progress', 'done',
      ]);
    });

    it('should have 4 drop list IDs', () => {
      expect(component.allDropListIds).toEqual([
        'board-backlog', 'board-today', 'board-in_progress', 'board-done',
      ]);
    });

    it('should have null dragOverColumn', () => {
      expect(component.dragOverColumn()).toBeNull();
    });

    it('should have null landedTaskId', () => {
      expect(component.landedTaskId()).toBeNull();
    });
  });

  describe('columnTasks computed', () => {
    it('should return empty arrays when board is null', () => {
      const result = component.columnTasks();
      expect(result.backlog).toEqual([]);
      expect(result.today).toEqual([]);
      expect(result.in_progress).toEqual([]);
      expect(result.done).toEqual([]);
    });

    it('should return tasks grouped by column when board is loaded', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.board()).toBeTruthy();
      });

      const result = component.columnTasks();
      expect(result.backlog).toHaveLength(1);
      expect(result.backlog[0].task_title).toBe('Backlog Task');
      expect(result.today).toHaveLength(1);
      expect(result.in_progress).toHaveLength(0);
      expect(result.done).toHaveLength(1);
    });
  });

  describe('ngOnInit()', () => {
    it('should call getBoard and populate board signal', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      expect(mockBoardService.getBoard).toHaveBeenCalled();
      expect(component.board()).toEqual(MOCK_BOARD);
    });

    it('should set loading to false on error', async () => {
      mockBoardService.getBoard.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      expect(component.board()).toBeNull();
    });
  });

  describe('toCard()', () => {
    it('should convert PersonalBoardItem to TaskCardData', () => {
      const item = makeBoardItem({
        task_id: 'task-42',
        task_title: 'My Card',
        task_priority: 'high',
        task_due_date: '2026-04-01',
        status_name: 'In Progress',
        project_name: 'Alpha',
      });

      const card = component.toCard(item);
      expect(card.id).toBe('task-42');
      expect(card.title).toBe('My Card');
      expect(card.priority).toBe('high');
      expect(card.due_date).toBe('2026-04-01');
      expect(card.status).toBe('In Progress');
      expect(card.project_name).toBe('Alpha');
    });

    it('should default priority to none when null', () => {
      const item = makeBoardItem({ task_priority: 'none' });
      const card = component.toCard(item);
      expect(card.priority).toBe('none');
    });
  });

  describe('onTaskClick()', () => {
    it('should navigate to task detail', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.onTaskClick('task-99');
      expect(navigateSpy).toHaveBeenCalledWith(['/task', 'task-99']);
    });
  });

  describe('dragOverColumn signal', () => {
    it('should update when set', () => {
      component.dragOverColumn.set('today');
      expect(component.dragOverColumn()).toBe('today');

      component.dragOverColumn.set(null);
      expect(component.dragOverColumn()).toBeNull();
    });
  });
});
