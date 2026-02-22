import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter, Router, NavigationEnd } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { SidebarRecentComponent, RecentBoardEntry } from './sidebar-recent.component';
import { BoardService } from '../../../core/services/board.service';

describe('SidebarRecentComponent', () => {
  let component: SidebarRecentComponent;
  let fixture: ComponentFixture<SidebarRecentComponent>;
  let mockBoardService: any;

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

    // Clear localStorage before each test
    localStorage.removeItem('taskflow_recent_boards');

    mockBoardService = {
      getBoard: vi.fn().mockReturnValue(of({ id: 'b-1', name: 'My Board' })),
    };

    await TestBed.configureTestingModule({
      imports: [SidebarRecentComponent],
      providers: [
        provideRouter([]),
        { provide: BoardService, useValue: mockBoardService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarRecentComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.removeItem('taskflow_recent_boards');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load from localStorage on init', () => {
    const stored: RecentBoardEntry[] = [
      { id: 'b-1', name: 'Board 1', workspaceId: 'ws-1', visitedAt: Date.now() },
    ];
    localStorage.setItem('taskflow_recent_boards', JSON.stringify(stored));

    component.ngOnInit();
    expect(component.recentItems().length).toBe(1);
    expect(component.recentItems()[0].name).toBe('Board 1');
  });

  it('should handle corrupted localStorage data', () => {
    localStorage.setItem('taskflow_recent_boards', '{invalid json}');
    component.ngOnInit();
    expect(component.recentItems().length).toBe(0);
  });

  it('should handle empty localStorage', () => {
    component.ngOnInit();
    expect(component.recentItems().length).toBe(0);
  });

  it('should filter out expired items (older than 30 days)', () => {
    const oldEntry: RecentBoardEntry = {
      id: 'b-old',
      name: 'Old Board',
      workspaceId: 'ws-1',
      visitedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    };
    const recentEntry: RecentBoardEntry = {
      id: 'b-recent',
      name: 'Recent Board',
      workspaceId: 'ws-1',
      visitedAt: Date.now(),
    };
    localStorage.setItem('taskflow_recent_boards', JSON.stringify([oldEntry, recentEntry]));

    component.ngOnInit();
    expect(component.recentItems().length).toBe(1);
    expect(component.recentItems()[0].id).toBe('b-recent');
  });

  it('should add a recent entry and save to storage', () => {
    component.addRecentEntry({
      id: 'b-1',
      name: 'Board 1',
      workspaceId: 'ws-1',
      visitedAt: Date.now(),
    });

    expect(component.recentItems().length).toBe(1);
    const stored = JSON.parse(localStorage.getItem('taskflow_recent_boards') || '[]');
    expect(stored.length).toBe(1);
  });

  it('should deduplicate entries by id, keeping the newest', () => {
    component.addRecentEntry({
      id: 'b-1',
      name: 'Board Old',
      workspaceId: 'ws-1',
      visitedAt: Date.now() - 10000,
    });
    component.addRecentEntry({
      id: 'b-1',
      name: 'Board New',
      workspaceId: 'ws-1',
      visitedAt: Date.now(),
    });

    expect(component.recentItems().length).toBe(1);
    expect(component.recentItems()[0].name).toBe('Board New');
  });

  it('should limit entries to 5', () => {
    for (let i = 0; i < 7; i++) {
      component.addRecentEntry({
        id: `b-${i}`,
        name: `Board ${i}`,
        workspaceId: 'ws-1',
        visitedAt: Date.now() + i,
      });
    }
    expect(component.recentItems().length).toBe(5);
  });

  it('should update entry name', () => {
    component.addRecentEntry({
      id: 'b-1',
      name: 'placeholder...',
      workspaceId: 'ws-1',
      visitedAt: Date.now(),
    });

    component.updateEntryName('b-1', 'Real Board Name');
    expect(component.recentItems()[0].name).toBe('Real Board Name');
  });

  it('should not change entries when updating name for non-existent id', () => {
    component.addRecentEntry({
      id: 'b-1',
      name: 'Board 1',
      workspaceId: 'ws-1',
      visitedAt: Date.now(),
    });

    component.updateEntryName('b-999', 'No Match');
    expect(component.recentItems()[0].name).toBe('Board 1');
  });

  it('should unsubscribe from router events on destroy', () => {
    component.ngOnInit();
    // Should not throw
    component.ngOnDestroy();
  });

  it('should default collapsed input to false', () => {
    expect(component.collapsed()).toBe(false);
  });
});
