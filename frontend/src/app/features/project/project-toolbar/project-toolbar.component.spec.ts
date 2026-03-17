import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { ProjectToolbarComponent } from './project-toolbar.component';

describe('ProjectToolbarComponent', () => {
  let component: ProjectToolbarComponent;
  let fixture: ComponentFixture<ProjectToolbarComponent>;
  let router: Router;
  let queryParamsSubject: Subject<any>;

  beforeEach(async () => {
    if (!window.matchMedia) {
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
    }

    queryParamsSubject = new Subject();

    await TestBed.configureTestingModule({
      imports: [ProjectToolbarComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectToolbarComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load filters from URL query params', () => {
      component.ngOnInit();
      queryParamsSubject.next({
        search: 'hello',
        priorities: 'high,urgent',
        assignees: 'u-1,u-2',
        dueDateStart: '2026-01-01',
        dueDateEnd: '2026-01-31',
        labels: 'l-1',
      });
      expect(component.searchTerm()).toBe('hello');
      expect(component.filters().priorities).toEqual(['high', 'urgent']);
      expect(component.filters().assigneeIds).toEqual(['u-1', 'u-2']);
      expect(component.filters().dueDateStart).toBe('2026-01-01');
      expect(component.filters().dueDateEnd).toBe('2026-01-31');
      expect(component.filters().labelIds).toEqual(['l-1']);
      expect(component.selectedPriorities).toEqual(['high', 'urgent']);
      expect(component.selectedAssignees).toEqual(['u-1', 'u-2']);
    });

    it('should handle empty query params', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      expect(component.searchTerm()).toBe('');
      expect(component.filters().priorities).toEqual([]);
    });

    it('should debounce search input and emit filtersChanged', fakeAsync(() => {
      const emitSpy = vi.spyOn(component.filtersChanged, 'emit');
      component.ngOnInit();
      queryParamsSubject.next({});

      component.onSearchChange('test');
      expect(component.searchTerm()).toBe('test');
      expect(emitSpy).not.toHaveBeenCalled();

      tick(300);
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test' }),
      );
    }));
  });

  describe('activeFilterCount', () => {
    it('should return 0 when no filters are set', () => {
      expect(component.activeFilterCount()).toBe(0);
    });

    it('should count search as one filter', () => {
      component.filters.set({ ...component.filters(), search: 'test' });
      expect(component.activeFilterCount()).toBe(1);
    });

    it('should count priorities as one filter', () => {
      component.filters.set({
        ...component.filters(),
        priorities: ['high'] as any,
      });
      expect(component.activeFilterCount()).toBe(1);
    });

    it('should count assignees as one filter', () => {
      component.filters.set({ ...component.filters(), assigneeIds: ['u-1'] });
      expect(component.activeFilterCount()).toBe(1);
    });

    it('should count due date range as one filter', () => {
      component.filters.set({
        ...component.filters(),
        dueDateStart: '2026-01-01',
      });
      expect(component.activeFilterCount()).toBe(1);
    });

    it('should count labels as one filter', () => {
      component.filters.set({ ...component.filters(), labelIds: ['l-1'] });
      expect(component.activeFilterCount()).toBe(1);
    });

    it('should sum multiple active filters', () => {
      component.filters.set({
        search: 'test',
        priorities: ['high'] as any,
        assigneeIds: ['u-1'],
        dueDateStart: '2026-01-01',
        dueDateEnd: null,
        labelIds: ['l-1'],
      });
      // search(1) + priorities(1) + assignees(1) + dueDate(1) + labels(1) = 5
      expect(component.activeFilterCount()).toBe(5);
    });
  });

  describe('getInitials', () => {
    it('should return initials from full name', () => {
      expect(component.getInitials('John Doe')).toBe('JD');
    });

    it('should handle single name', () => {
      expect(component.getInitials('Alice')).toBe('A');
    });

    it('should handle three-part name', () => {
      expect(component.getInitials('John Peter Doe')).toBe('JP');
    });
  });

  describe('onPriorityFilterChange', () => {
    it('should update filters and emit', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      const emitSpy = vi.spyOn(component.filtersChanged, 'emit');
      component.onPriorityFilterChange(['high', 'urgent']);
      expect(component.filters().priorities).toEqual(['high', 'urgent']);
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('onAssigneeFilterChange', () => {
    it('should update assignee filter and emit', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      const emitSpy = vi.spyOn(component.filtersChanged, 'emit');
      component.onAssigneeFilterChange(['u-1']);
      expect(component.filters().assigneeIds).toEqual(['u-1']);
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('onDueDateStartPickerChange', () => {
    it('should format date to ISO string and update filter', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      const emitSpy = vi.spyOn(component.filtersChanged, 'emit');
      component.onDueDateStartPickerChange(new Date('2026-06-15'));
      expect(component.filters().dueDateStart).toBe('2026-06-15');
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should set dueDateStart to null when cleared', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      component.onDueDateStartPickerChange(null);
      expect(component.filters().dueDateStart).toBeNull();
    });
  });

  describe('onDueDateEndPickerChange', () => {
    it('should format date to ISO string and update filter', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      component.onDueDateEndPickerChange(new Date('2026-07-15'));
      expect(component.filters().dueDateEnd).toBe('2026-07-15');
    });

    it('should set dueDateEnd to null when cleared', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      component.onDueDateEndPickerChange(null);
      expect(component.filters().dueDateEnd).toBeNull();
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters to default', () => {
      component.ngOnInit();
      queryParamsSubject.next({ search: 'hello', priorities: 'high' });
      const emitSpy = vi.spyOn(component.filtersChanged, 'emit');

      component.clearFilters();

      expect(component.searchTerm()).toBe('');
      expect(component.selectedPriorities).toEqual([]);
      expect(component.selectedAssignees).toEqual([]);
      expect(component.dueDateStartValue).toBeNull();
      expect(component.dueDateEndValue).toBeNull();
      expect(component.filters().search).toBe('');
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('isOverdueActive', () => {
    it('should return false by default', () => {
      expect(component.isOverdueActive()).toBe(false);
    });

    it('should return true after toggleOverdue()', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      component.toggleOverdue();
      expect(component.isOverdueActive()).toBe(true);
    });

    it('should toggle back to false on second toggleOverdue()', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      component.toggleOverdue();
      component.toggleOverdue();
      expect(component.isOverdueActive()).toBe(false);
    });
  });

  describe('anyQuickFilterActive', () => {
    it('should return false when no quick filters are active', () => {
      expect(component.anyQuickFilterActive()).toBe(false);
    });

    it('should return true after toggleOverdue()', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      component.toggleOverdue();
      expect(component.anyQuickFilterActive()).toBe(true);
    });

    it('should return true when high priority is active', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      component.toggleHighPriority();
      expect(component.anyQuickFilterActive()).toBe(true);
    });
  });

  describe('clearQuickFilters', () => {
    it('should reset priorities, assignees, date range, and overdue to defaults', () => {
      component.ngOnInit();
      queryParamsSubject.next({});
      const emitSpy = vi.spyOn(component.filtersChanged, 'emit');

      component.filters.set({
        ...component.filters(),
        priorities: ['high', 'urgent'] as any,
        assigneeIds: ['u-1'],
        dueDateStart: '2026-01-01',
        dueDateEnd: '2026-01-07',
        overdue: true,
      });

      component.clearQuickFilters();

      expect(component.filters().priorities).toEqual([]);
      expect(component.filters().assigneeIds).toEqual([]);
      expect(component.filters().dueDateStart).toBeNull();
      expect(component.filters().dueDateEnd).toBeNull();
      expect(component.filters().overdue).toBe(false);
      expect(component.selectedPriorities).toEqual([]);
      expect(component.selectedAssignees).toEqual([]);
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should preserve search and labelIds when clearing quick filters', () => {
      component.ngOnInit();
      queryParamsSubject.next({});

      component.filters.set({
        ...component.filters(),
        search: 'important',
        labelIds: ['l-1'],
        overdue: true,
      });

      component.clearQuickFilters();

      expect(component.filters().search).toBe('important');
      expect(component.filters().labelIds).toEqual(['l-1']);
    });
  });

  describe('activeFilterCount with overdue', () => {
    it('should count overdue as one filter when active', () => {
      component.filters.set({ ...component.filters(), overdue: true });
      expect(component.activeFilterCount()).toBe(1);
    });

    it('should not count overdue when inactive', () => {
      component.filters.set({ ...component.filters(), overdue: false });
      expect(component.activeFilterCount()).toBe(0);
    });

    it('should sum overdue with other active filters', () => {
      component.filters.set({
        search: 'test',
        priorities: ['high'] as any,
        assigneeIds: [],
        dueDateStart: null,
        dueDateEnd: null,
        labelIds: [],
        overdue: true,
      });
      expect(component.activeFilterCount()).toBe(3);
    });
  });
});
