import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  GlobalSearchComponent,
  CommandAction,
} from './global-search.component';
import {
  SearchService,
  SearchResults,
  TaskSearchResult,
  BoardSearchResult,
  CommentSearchResult,
} from '../../../core/services/search.service';
import { ThemeService } from '../../../core/services/theme.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';

const EMPTY_RESULTS: SearchResults = {
  tasks: [],
  boards: [],
  comments: [],
};

const SAMPLE_RESULTS: SearchResults = {
  tasks: [
    {
      id: 'task-1',
      title: 'Fix Bug',
      description: 'Fix the login bug',
      board_id: 'board-1',
      board_name: 'Sprint Board',
      workspace_id: 'ws-1',
      workspace_name: 'My Workspace',
    },
  ],
  boards: [
    {
      id: 'board-1',
      name: 'Sprint Board',
      description: 'Main board',
      workspace_id: 'ws-1',
      workspace_name: 'My Workspace',
    },
  ],
  comments: [
    {
      id: 'comment-1',
      content: 'Looks good',
      task_id: 'task-1',
      task_title: 'Fix Bug',
      board_id: 'board-1',
      board_name: 'Sprint Board',
      workspace_id: 'ws-1',
    },
  ],
};

describe('GlobalSearchComponent', () => {
  let component: GlobalSearchComponent;
  let fixture: ComponentFixture<GlobalSearchComponent>;
  let mockSearchService: { search: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockThemeService: {
    resolvedTheme: ReturnType<typeof vi.fn>;
    setTheme: ReturnType<typeof vi.fn>;
  };
  let mockShortcutsService: { helpRequested$: Subject<void> };

  beforeEach(async () => {
    mockSearchService = {
      search: vi.fn().mockReturnValue(of(EMPTY_RESULTS)),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockThemeService = {
      resolvedTheme: vi.fn().mockReturnValue('light'),
      setTheme: vi.fn(),
    };

    mockShortcutsService = {
      helpRequested$: new Subject<void>(),
    };

    // Mock localStorage
    const storage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key) => storage[key] ?? null,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      storage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete storage[key];
    });

    await TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: Router, useValue: mockRouter },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: KeyboardShortcutsService, useValue: mockShortcutsService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalSearchComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start with empty query', () => {
      expect(component.query()).toBe('');
    });

    it('should start with loading false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should start with no results', () => {
      expect(component.results()).toBeNull();
    });

    it('should start with hasSearched false', () => {
      expect(component.hasSearched()).toBe(false);
    });

    it('should start closed', () => {
      expect(component.isOpen()).toBe(false);
    });
  });

  describe('isCommandMode', () => {
    it('should be false for normal text', () => {
      component.query.set('search text');
      expect(component.isCommandMode()).toBe(false);
    });

    it('should be true when query starts with >', () => {
      component.query.set('>create task');
      expect(component.isCommandMode()).toBe(true);
    });

    it('should be false for empty string', () => {
      component.query.set('');
      expect(component.isCommandMode()).toBe(false);
    });
  });

  describe('filteredActions', () => {
    it('should return all actions when command query is empty', () => {
      component.query.set('>');
      const actions = component.filteredActions();
      expect(actions.length).toBe(component.actions.length);
    });

    it('should filter actions by label', () => {
      component.query.set('>dashboard');
      const actions = component.filteredActions();
      expect(actions.length).toBe(1);
      expect(actions[0].label).toContain('Dashboard');
    });

    it('should be case-insensitive', () => {
      component.query.set('>DARK MODE');
      const actions = component.filteredActions();
      expect(actions.length).toBe(1);
      expect(actions[0].label).toContain('Dark Mode');
    });

    it('should return empty array when no actions match', () => {
      component.query.set('>xyznonexistent');
      const actions = component.filteredActions();
      expect(actions.length).toBe(0);
    });
  });

  describe('hasResults', () => {
    it('should return false when results is null', () => {
      component.results.set(null);
      expect(component.hasResults()).toBe(false);
    });

    it('should return false when all result arrays are empty', () => {
      component.results.set(EMPTY_RESULTS);
      expect(component.hasResults()).toBe(false);
    });

    it('should return true when tasks exist', () => {
      component.results.set({ ...EMPTY_RESULTS, tasks: SAMPLE_RESULTS.tasks });
      expect(component.hasResults()).toBe(true);
    });

    it('should return true when boards exist', () => {
      component.results.set({
        ...EMPTY_RESULTS,
        boards: SAMPLE_RESULTS.boards,
      });
      expect(component.hasResults()).toBe(true);
    });

    it('should return true when comments exist', () => {
      component.results.set({
        ...EMPTY_RESULTS,
        comments: SAMPLE_RESULTS.comments,
      });
      expect(component.hasResults()).toBe(true);
    });
  });

  describe('onQueryChange()', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should update the query signal', () => {
      component.onQueryChange('new text');
      expect(component.query()).toBe('new text');
    });

    it('should not trigger search for command mode queries', () => {
      component.onQueryChange('>test');
      expect(component.query()).toBe('>test');
      // searchSubject should not have been called
    });
  });

  describe('clearQuery()', () => {
    it('should reset query to empty', () => {
      component.query.set('something');
      component.clearQuery();
      expect(component.query()).toBe('');
    });

    it('should reset results to null', () => {
      component.results.set(SAMPLE_RESULTS);
      component.clearQuery();
      expect(component.results()).toBeNull();
    });

    it('should reset hasSearched to false', () => {
      component.hasSearched.set(true);
      component.clearQuery();
      expect(component.hasSearched()).toBe(false);
    });
  });

  describe('executeAction()', () => {
    it('should call the action function and close', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      const actionFn = vi.fn();
      const action: CommandAction = {
        icon: 'test',
        label: 'Test Action',
        action: actionFn,
      };

      component.executeAction(action);

      expect(actionFn).toHaveBeenCalled();
      expect(closedSpy).toHaveBeenCalled();
    });
  });

  describe('onBackdropClick()', () => {
    it('should close the dialog', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      component.onBackdropClick({} as MouseEvent);
      expect(closedSpy).toHaveBeenCalled();
    });
  });

  describe('onKeydown()', () => {
    it('should close the dialog on Escape key', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closedSpy).toHaveBeenCalled();
    });

    it('should not close on other keys', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(closedSpy).not.toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('should emit closed event', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      component.close();
      expect(closedSpy).toHaveBeenCalled();
    });
  });

  describe('navigation methods', () => {
    it('navigateToTask should navigate with correct params and close', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      const task: TaskSearchResult = {
        id: 'task-1',
        title: 'Test',
        description: null,
        board_id: 'board-1',
        board_name: 'Board',
        workspace_id: 'ws-1',
        workspace_name: 'WS',
      };

      component.navigateToTask(task);

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/workspace', 'ws-1', 'board', 'board-1'],
        { queryParams: { task: 'task-1' } },
      );
      expect(closedSpy).toHaveBeenCalled();
    });

    it('navigateToBoard should navigate with correct params and close', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      const board: BoardSearchResult = {
        id: 'board-1',
        name: 'Board',
        description: null,
        workspace_id: 'ws-1',
        workspace_name: 'WS',
      };

      component.navigateToBoard(board);

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/workspace',
        'ws-1',
        'board',
        'board-1',
      ]);
      expect(closedSpy).toHaveBeenCalled();
    });

    it('navigateToComment should navigate with correct params and close', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      const comment: CommentSearchResult = {
        id: 'comment-1',
        content: 'Comment',
        task_id: 'task-1',
        task_title: 'Task',
        board_id: 'board-1',
        board_name: 'Board',
        workspace_id: 'ws-1',
      };

      component.navigateToComment(comment);

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/workspace', 'ws-1', 'board', 'board-1'],
        { queryParams: { task: 'task-1' } },
      );
      expect(closedSpy).toHaveBeenCalled();
    });
  });

  describe('recent searches', () => {
    it('onRecentClick should set query and trigger search', () => {
      component.ngOnInit();
      component.onRecentClick('old query');
      expect(component.query()).toBe('old query');
    });

    it('clearRecentSearches should empty the list', () => {
      component.recentSearches.set(['query1', 'query2']);
      component.clearRecentSearches();
      expect(component.recentSearches()).toEqual([]);
    });

    it('clearRecentSearches should remove from localStorage', () => {
      component.clearRecentSearches();
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        'taskflow_recent_searches',
      );
    });
  });

  describe('ngOnDestroy()', () => {
    it('should not throw', () => {
      component.ngOnInit();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('search pipeline (with debounce)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      component.ngOnInit();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger search via debounced pipeline', () => {
      mockSearchService.search.mockReturnValue(of(SAMPLE_RESULTS));

      component.onQueryChange('test query');
      vi.advanceTimersByTime(300);

      expect(mockSearchService.search).toHaveBeenCalledWith('test query');
      expect(component.results()).toEqual(SAMPLE_RESULTS);
      expect(component.hasSearched()).toBe(true);
      expect(component.loading()).toBe(false);
    });

    it('should not search for empty query', () => {
      component.onQueryChange('');
      vi.advanceTimersByTime(300);

      expect(mockSearchService.search).not.toHaveBeenCalled();
      expect(component.results()).toBeNull();
    });

    it('should not search for whitespace-only query', () => {
      component.onQueryChange('   ');
      vi.advanceTimersByTime(300);

      expect(mockSearchService.search).not.toHaveBeenCalled();
    });

    it('should save recent search on successful search', () => {
      mockSearchService.search.mockReturnValue(of(SAMPLE_RESULTS));

      component.onQueryChange('my search');
      vi.advanceTimersByTime(300);

      expect(component.recentSearches()).toContain('my search');
    });
  });

  describe('loadRecentSearches', () => {
    it('should load recent searches from localStorage on init', () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(['search1', 'search2']),
      );

      component.ngOnInit();

      expect(component.recentSearches()).toEqual(['search1', 'search2']);
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        'invalid json{',
      );

      expect(() => component.ngOnInit()).not.toThrow();
    });

    it('should handle null localStorage value', () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      component.ngOnInit();

      expect(component.recentSearches()).toEqual([]);
    });
  });
});
