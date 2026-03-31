import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TrashComponent } from './trash.component';
import { WorkspaceService } from '../../../core/services/workspace.service';

describe('TrashComponent', () => {
  let component: TrashComponent;
  let fixture: ComponentFixture<TrashComponent>;
  let mockWorkspaceService: any;

  const mockTrashItems = [
    {
      entity_type: 'board',
      entity_id: 'b-1',
      name: 'Deleted Board',
      deleted_at: '2026-03-01',
      deleted_by_name: 'Alice',
      days_remaining: 15,
    },
    {
      entity_type: 'task',
      entity_id: 't-1',
      name: 'Deleted Task',
      deleted_at: '2026-03-10',
      deleted_by_name: null,
      days_remaining: 20,
    },
  ];

  beforeEach(async () => {
    mockWorkspaceService = {
      listTrash: vi.fn().mockReturnValue(
        of({ items: mockTrashItems, next_cursor: null }),
      ),
      restoreTrashItem: vi.fn().mockReturnValue(of(undefined)),
      deleteTrashItem: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [TrashComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TrashComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial signal values', () => {
    expect(component.items()).toEqual([]);
    expect(component.loading()).toBe(true);
    expect(component.loadingMore()).toBe(false);
    expect(component.restoring()).toBe(false);
    expect(component.deleting()).toBe(false);
    expect(component.nextCursor()).toBeNull();
    expect(component.typeFilter).toBe('');
  });

  it('should load trash on init', () => {
    fixture.detectChanges();

    expect(mockWorkspaceService.listTrash).toHaveBeenCalledWith('ws-1', {
      page_size: 20,
      entity_type: undefined,
    });
    expect(component.items().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should pass typeFilter to listTrash', () => {
    component.typeFilter = 'board';
    fixture.detectChanges();

    expect(mockWorkspaceService.listTrash).toHaveBeenCalledWith('ws-1', {
      page_size: 20,
      entity_type: 'board',
    });
  });

  it('should handle load error', () => {
    mockWorkspaceService.listTrash.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.items()).toEqual([]);
  });

  it('should load more items with cursor', () => {
    mockWorkspaceService.listTrash
      .mockReturnValueOnce(of({ items: mockTrashItems, next_cursor: 'cur-1' }))
      .mockReturnValueOnce(
        of({
          items: [
            {
              entity_type: 'task',
              entity_id: 't-2',
              name: 'Another Task',
              deleted_at: '2026-03-15',
              deleted_by_name: null,
              days_remaining: 25,
            },
          ],
          next_cursor: null,
        }),
      );

    fixture.detectChanges();
    expect(component.nextCursor()).toBe('cur-1');

    component.loadMore();

    expect(component.items().length).toBe(3);
    expect(component.nextCursor()).toBeNull();
    expect(component.loadingMore()).toBe(false);
  });

  it('should not load more when no cursor', () => {
    fixture.detectChanges();

    component.loadMore();

    // only called once in ngOnInit
    expect(mockWorkspaceService.listTrash).toHaveBeenCalledTimes(1);
  });

  it('should handle loadMore error', () => {
    mockWorkspaceService.listTrash
      .mockReturnValueOnce(of({ items: mockTrashItems, next_cursor: 'cur-1' }))
      .mockReturnValueOnce(throwError(() => new Error('fail')));

    fixture.detectChanges();
    component.loadMore();

    expect(component.loadingMore()).toBe(false);
  });

  it('should restore item and remove from list', () => {
    fixture.detectChanges();

    component.restoreItem(component.items()[0]);

    expect(mockWorkspaceService.restoreTrashItem).toHaveBeenCalledWith(
      'ws-1',
      'board',
      'b-1',
    );
    expect(component.items().length).toBe(1);
    expect(component.items()[0].entity_id).toBe('t-1');
    expect(component.restoring()).toBe(false);
  });

  it('should handle restore error', () => {
    mockWorkspaceService.restoreTrashItem.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    component.restoreItem(component.items()[0]);

    expect(component.restoring()).toBe(false);
  });

  it('should delete item and remove from list', () => {
    fixture.detectChanges();

    component.deleteItem(component.items()[1]);

    expect(mockWorkspaceService.deleteTrashItem).toHaveBeenCalledWith(
      'ws-1',
      'task',
      't-1',
    );
    expect(component.items().length).toBe(1);
    expect(component.items()[0].entity_id).toBe('b-1');
    expect(component.deleting()).toBe(false);
  });

  it('should handle delete error', () => {
    mockWorkspaceService.deleteTrashItem.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    component.deleteItem(component.items()[0]);

    expect(component.deleting()).toBe(false);
  });
});
