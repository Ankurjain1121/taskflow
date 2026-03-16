import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  BulkActionsBarComponent,
  BulkAction,
} from './bulk-actions-bar.component';

describe('BulkActionsBarComponent', () => {
  let component: BulkActionsBarComponent;
  let fixture: ComponentFixture<BulkActionsBarComponent>;

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

    await TestBed.configureTestingModule({
      imports: [BulkActionsBarComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkActionsBarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit move action with column_id', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onMoveToColumn('col-123');

    expect(spy).toHaveBeenCalledWith({
      type: 'move',
      column_id: 'col-123',
    } as BulkAction);
  });

  it('should not emit move action for empty column id', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onMoveToColumn('');

    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit priority action', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onSetPriority('high');

    expect(spy).toHaveBeenCalledWith({
      type: 'priority',
      priority: 'high',
    } as BulkAction);
  });

  it('should not emit priority action for empty value', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onSetPriority('');

    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit set milestone action', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onSetMilestone('ms-1');

    expect(spy).toHaveBeenCalledWith({
      type: 'milestone',
      milestone_id: 'ms-1',
    } as BulkAction);
  });

  it('should emit clear milestone action', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onSetMilestone('__clear');

    expect(spy).toHaveBeenCalledWith({
      type: 'milestone',
      clear_milestone: true,
    } as BulkAction);
  });

  it('should emit move to group action', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onMoveToGroup('group-1');

    expect(spy).toHaveBeenCalledWith({
      type: 'group',
      group_id: 'group-1',
    } as BulkAction);
  });

  it('should emit clear group action', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onMoveToGroup('__clear');

    expect(spy).toHaveBeenCalledWith({
      type: 'group',
      clear_group: true,
    } as BulkAction);
  });

  it('should emit delete action', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onDelete();

    expect(spy).toHaveBeenCalledWith({ type: 'delete' } as BulkAction);
  });

  it('should emit cancelSelection on cancel', () => {
    const spy = vi.fn();
    component.cancelSelection.subscribe(spy);

    component.onCancel();

    expect(spy).toHaveBeenCalled();
  });

  it('should not emit milestone for empty value', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onSetMilestone('');

    expect(spy).not.toHaveBeenCalled();
  });

  it('should not emit group for empty value', () => {
    const spy = vi.fn();
    component.bulkAction.subscribe(spy);

    component.onMoveToGroup('');

    expect(spy).not.toHaveBeenCalled();
  });

  it('should accept columns input', () => {
    fixture.componentRef.setInput('columns', [
      { id: 'col-1', name: 'To Do' },
      { id: 'col-2', name: 'Done' },
    ]);
    fixture.componentRef.setInput('selectedCount', 3);
    fixture.detectChanges();

    expect(component.columns().length).toBe(2);
    expect(component.selectedCount()).toBe(3);
  });
});
