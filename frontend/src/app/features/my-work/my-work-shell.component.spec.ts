import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { MyWorkShellComponent } from './my-work-shell.component';
import { MyTasksService, MyTasksSummary } from '../../core/services/my-tasks.service';

const MOCK_SUMMARY: MyTasksSummary = {
  total_assigned: 15,
  due_soon: 4,
  overdue: 2,
  completed_this_week: 7,
};

describe('MyWorkShellComponent', () => {
  let component: MyWorkShellComponent;
  let fixture: ComponentFixture<MyWorkShellComponent>;

  const mockMyTasksService = {
    getMyTasksSummary: vi.fn().mockReturnValue(of(MOCK_SUMMARY)),
  };

  const mockActivatedRoute = {
    snapshot: {
      data: {},
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMyTasksService.getMyTasksSummary.mockReturnValue(of(MOCK_SUMMARY));

    // Clear localStorage before each test
    localStorage.removeItem('taskbolt_mywork_tab');

    await TestBed.configureTestingModule({
      imports: [MyWorkShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MyTasksService, useValue: mockMyTasksService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MyWorkShellComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should default activeTab to timeline when no saved tab', () => {
      expect(component.activeTab()).toBe('timeline');
    });

    it('should have null summary before loading', () => {
      // summary starts null until ngOnInit loads it
      expect(component.summary()).toBeNull();
    });

    it('should have 3 tabs defined', () => {
      expect(component.tabs).toHaveLength(3);
      expect(component.tabs.map((t) => t.key)).toEqual(['timeline', 'matrix', 'board']);
    });
  });

  describe('tab persistence', () => {
    it('should restore saved tab from localStorage', async () => {
      localStorage.setItem('taskbolt_mywork_tab', 'board');

      // Rebuild component to pick up localStorage
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [MyWorkShellComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: MyTasksService, useValue: mockMyTasksService },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const newFixture = TestBed.createComponent(MyWorkShellComponent);
      const newComponent = newFixture.componentInstance;
      expect(newComponent.activeTab()).toBe('board');
    });

    it('should ignore invalid saved tab and default to timeline', async () => {
      localStorage.setItem('taskbolt_mywork_tab', 'invalid_tab');

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [MyWorkShellComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: MyTasksService, useValue: mockMyTasksService },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const newFixture = TestBed.createComponent(MyWorkShellComponent);
      const newComponent = newFixture.componentInstance;
      expect(newComponent.activeTab()).toBe('timeline');
    });
  });

  describe('route data defaultTab', () => {
    it('should use defaultTab from route data when present', async () => {
      const routeWithTab = {
        snapshot: { data: { defaultTab: 'matrix' } },
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [MyWorkShellComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: MyTasksService, useValue: mockMyTasksService },
          { provide: ActivatedRoute, useValue: routeWithTab },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const newFixture = TestBed.createComponent(MyWorkShellComponent);
      const newComponent = newFixture.componentInstance;
      expect(newComponent.activeTab()).toBe('matrix');
    });
  });

  describe('ngOnInit()', () => {
    it('should load summary from service', async () => {
      component.ngOnInit();
      // Wait for async loadSummary to complete
      await vi.waitFor(() => {
        expect(component.summary()).toEqual(MOCK_SUMMARY);
      });
    });

    it('should leave summary null on service error', async () => {
      mockMyTasksService.getMyTasksSummary.mockReturnValue(
        throwError(() => new Error('network error')),
      );

      component.ngOnInit();
      // Give the promise time to reject
      await vi.waitFor(() => {
        expect(mockMyTasksService.getMyTasksSummary).toHaveBeenCalled();
      });
      expect(component.summary()).toBeNull();
    });
  });

  describe('onMobileTabChange()', () => {
    it('should update activeTab from select event', () => {
      const event = { target: { value: 'board' } } as unknown as Event;
      component.onMobileTabChange(event);
      expect(component.activeTab()).toBe('board');
    });

    it('should update activeTab to matrix', () => {
      const event = { target: { value: 'matrix' } } as unknown as Event;
      component.onMobileTabChange(event);
      expect(component.activeTab()).toBe('matrix');
    });
  });

  describe('tab switching', () => {
    it('should allow setting activeTab directly', () => {
      component.activeTab.set('board');
      expect(component.activeTab()).toBe('board');

      component.activeTab.set('matrix');
      expect(component.activeTab()).toBe('matrix');

      component.activeTab.set('timeline');
      expect(component.activeTab()).toBe('timeline');
    });
  });
});
