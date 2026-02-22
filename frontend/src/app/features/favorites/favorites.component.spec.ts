import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FavoritesComponent } from './favorites.component';
import {
  FavoritesService,
  FavoriteItem,
} from '../../core/services/favorites.service';

function createMockFavorite(overrides: Partial<FavoriteItem> = {}): FavoriteItem {
  return {
    id: 'fav-1',
    entity_type: 'task',
    entity_id: 'task-1',
    name: 'Task One',
    board_id: 'b-1',
    workspace_id: 'ws-1',
    created_at: '2026-02-18T10:00:00Z',
    ...overrides,
  };
}

describe('FavoritesComponent', () => {
  let component: FavoritesComponent;
  let fixture: ComponentFixture<FavoritesComponent>;
  let mockFavoritesService: {
    list: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockFavoritesService = {
      list: vi.fn().mockReturnValue(of([])),
      remove: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [FavoritesComponent],
      providers: [
        provideRouter([]),
        { provide: FavoritesService, useValue: mockFavoritesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FavoritesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start in loading state', () => {
      expect(component.loading()).toBe(true);
    });

    it('should have no error', () => {
      expect(component.error()).toBeNull();
    });

    it('should have empty items', () => {
      expect(component.items()).toEqual([]);
    });

    it('should have empty taskItems', () => {
      expect(component.taskItems()).toEqual([]);
    });

    it('should have empty boardItems', () => {
      expect(component.boardItems()).toEqual([]);
    });
  });

  describe('ngOnInit / loadFavorites', () => {
    it('should load favorites on init', () => {
      const items = [
        createMockFavorite({ id: 'f1', entity_type: 'task' }),
        createMockFavorite({ id: 'f2', entity_type: 'board', entity_id: 'b-1', name: 'Board One' }),
      ];
      mockFavoritesService.list.mockReturnValue(of(items));

      component.ngOnInit();

      expect(component.items()).toEqual(items);
      expect(component.loading()).toBe(false);
    });

    it('should separate task and board items', () => {
      const items = [
        createMockFavorite({ id: 'f1', entity_type: 'task' }),
        createMockFavorite({ id: 'f2', entity_type: 'board' }),
        createMockFavorite({ id: 'f3', entity_type: 'task' }),
      ];
      mockFavoritesService.list.mockReturnValue(of(items));

      component.loadFavorites();

      expect(component.taskItems()).toHaveLength(2);
      expect(component.boardItems()).toHaveLength(1);
    });

    it('should set error on load failure', () => {
      mockFavoritesService.list.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      component.loadFavorites();

      expect(component.error()).toBe(
        'Failed to load favorites. Please try again.',
      );
      expect(component.loading()).toBe(false);
    });

    it('should clear error before loading', () => {
      component.error.set('old error');
      mockFavoritesService.list.mockReturnValue(of([]));

      component.loadFavorites();

      expect(component.error()).toBeNull();
    });
  });

  describe('unfavorite', () => {
    const taskItem = createMockFavorite({ id: 'f1', entity_type: 'task', entity_id: 'task-1' });
    const boardItem = createMockFavorite({
      id: 'f2',
      entity_type: 'board',
      entity_id: 'board-1',
      name: 'Board',
    });

    beforeEach(() => {
      component.items.set([taskItem, boardItem]);
      component.taskItems.set([taskItem]);
      component.boardItems.set([boardItem]);
    });

    it('should call remove with correct entity type and id', () => {
      mockFavoritesService.remove.mockReturnValue(of({ success: true }));

      component.unfavorite(taskItem);

      expect(mockFavoritesService.remove).toHaveBeenCalledWith('task', 'task-1');
    });

    it('should remove item from items list on success', () => {
      mockFavoritesService.remove.mockReturnValue(of({ success: true }));

      component.unfavorite(taskItem);

      expect(component.items()).toHaveLength(1);
      expect(component.items()[0].id).toBe('f2');
    });

    it('should update taskItems and boardItems on success', () => {
      mockFavoritesService.remove.mockReturnValue(of({ success: true }));

      component.unfavorite(taskItem);

      expect(component.taskItems()).toHaveLength(0);
      expect(component.boardItems()).toHaveLength(1);
    });

    it('should set error on failure', () => {
      mockFavoritesService.remove.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.unfavorite(taskItem);

      expect(component.error()).toBe(
        'Failed to remove favorite. Please try again.',
      );
    });

    it('should not modify items on failure', () => {
      mockFavoritesService.remove.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.unfavorite(taskItem);

      expect(component.items()).toHaveLength(2);
    });
  });
});
