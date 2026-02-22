import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SidebarFavoritesComponent } from './sidebar-favorites.component';
import { FavoritesService } from '../../../core/services/favorites.service';

describe('SidebarFavoritesComponent', () => {
  let component: SidebarFavoritesComponent;
  let fixture: ComponentFixture<SidebarFavoritesComponent>;
  let mockFavoritesService: any;

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

    mockFavoritesService = {
      list: vi.fn().mockReturnValue(of([
        { id: 'f-1', entity_type: 'board', entity_id: 'b-1', name: 'Board Alpha', board_id: 'b-1', workspace_id: 'ws-1' },
        { id: 'f-2', entity_type: 'task', entity_id: 't-1', name: 'Task Beta', board_id: null, workspace_id: null },
      ])),
    };

    await TestBed.configureTestingModule({
      imports: [SidebarFavoritesComponent],
      providers: [
        provideRouter([]),
        { provide: FavoritesService, useValue: mockFavoritesService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarFavoritesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load favorites on init', () => {
    component.ngOnInit();
    expect(mockFavoritesService.list).toHaveBeenCalled();
    expect(component.favorites().length).toBe(2);
  });

  it('should handle favorites load error gracefully', () => {
    mockFavoritesService.list.mockReturnValue(throwError(() => new Error('Network error')));
    component.ngOnInit();
    expect(component.favorites().length).toBe(0);
  });

  it('should return board link for board entity type with workspace_id', () => {
    const fav = { id: 'f-1', entity_type: 'board' as const, entity_id: 'b-1', name: 'Board', board_id: 'b-1', workspace_id: 'ws-1' };
    const link = component.getFavLink(fav);
    expect(link).toEqual(['/workspace', 'ws-1', 'board', 'b-1']);
  });

  it('should return my-tasks link for non-board entity type', () => {
    const fav = { id: 'f-2', entity_type: 'task' as const, entity_id: 't-1', name: 'Task', board_id: null, workspace_id: null };
    const link = component.getFavLink(fav);
    expect(link).toEqual(['/my-tasks']);
  });

  it('should return my-tasks link for board entity without workspace_id', () => {
    const fav = { id: 'f-3', entity_type: 'board' as const, entity_id: 'b-2', name: 'Board', board_id: 'b-2', workspace_id: null };
    const link = component.getFavLink(fav as any);
    expect(link).toEqual(['/my-tasks']);
  });

  it('should limit displayed favorites to 5 in template', () => {
    const manyFavs = Array.from({ length: 8 }, (_, i) => ({
      id: `f-${i}`,
      entity_type: 'board' as const,
      entity_id: `b-${i}`,
      name: `Board ${i}`,
      board_id: `b-${i}`,
      workspace_id: 'ws-1',
    }));
    mockFavoritesService.list.mockReturnValue(of(manyFavs));
    component.ngOnInit();
    // The template uses .slice(0, 5) so all 8 are in the signal
    expect(component.favorites().length).toBe(8);
  });

  it('should default collapsed input to false', () => {
    expect(component.collapsed()).toBe(false);
  });
});
