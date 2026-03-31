import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { WorkspaceLabelsComponent } from './workspace-labels.component';
import {
  WorkspaceService,
  WorkspaceLabel,
} from '../../../core/services/workspace.service';

describe('WorkspaceLabelsComponent', () => {
  let component: WorkspaceLabelsComponent;
  let fixture: ComponentFixture<WorkspaceLabelsComponent>;
  let mockWorkspaceService: any;

  const mockLabels: WorkspaceLabel[] = [
    {
      id: 'lbl-1',
      name: 'Bug',
      color: '#ef4444',
      workspace_id: 'ws-1',
      board_id: null,
      created_at: '2026-01-01',
    },
    {
      id: 'lbl-2',
      name: 'Feature',
      color: '#3b82f6',
      workspace_id: 'ws-1',
      board_id: null,
      created_at: '2026-01-02',
    },
  ];

  beforeEach(async () => {
    mockWorkspaceService = {
      listLabels: vi.fn().mockReturnValue(of(mockLabels)),
      createLabel: vi.fn().mockReturnValue(
        of({
          id: 'lbl-3',
          name: 'Enhancement',
          color: '#22c55e',
          workspace_id: 'ws-1',
          board_id: null,
          created_at: '2026-01-03',
        }),
      ),
      updateLabel: vi.fn().mockReturnValue(
        of({
          id: 'lbl-1',
          name: 'Critical Bug',
          color: '#dc2626',
          workspace_id: 'ws-1',
          board_id: null,
          created_at: '2026-01-01',
        }),
      ),
      deleteLabel: vi.fn().mockReturnValue(of(undefined)),
    };

    // Mock crypto.randomUUID for optimistic creates
    if (!globalThis.crypto?.randomUUID) {
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          randomUUID: () => 'temp-uuid-1234',
        },
        writable: true,
      });
    }

    await TestBed.configureTestingModule({
      imports: [WorkspaceLabelsComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceLabelsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial signal values', () => {
    expect(component.labels()).toEqual([]);
    expect(component.loading()).toBe(true);
    expect(component.creating()).toBe(false);
    expect(component.editingId()).toBeNull();
    expect(component.errorMessage()).toBeNull();
    expect(component.newName).toBe('');
    expect(component.editName).toBe('');
    expect(component.editColor).toBe('');
  });

  it('should load labels on init', () => {
    fixture.detectChanges();

    expect(mockWorkspaceService.listLabels).toHaveBeenCalledWith('ws-1');
    expect(component.labels()).toEqual(mockLabels);
    expect(component.loading()).toBe(false);
  });

  it('should handle load labels error', () => {
    mockWorkspaceService.listLabels.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
  });

  it('should create label optimistically and replace temp with real', () => {
    fixture.detectChanges();
    component.newName = 'Enhancement';
    component.newColor = '#22c55e';

    component.createLabel();

    // Input cleared
    expect(component.newName).toBe('');
    // Real label replaces temp
    const labels = component.labels();
    expect(labels.length).toBe(3);
    expect(labels[2].id).toBe('lbl-3');
    expect(labels[2].name).toBe('Enhancement');
  });

  it('should not create label with empty name', () => {
    component.newName = '   ';
    component.createLabel();

    expect(mockWorkspaceService.createLabel).not.toHaveBeenCalled();
  });

  it('should rollback on create error', () => {
    mockWorkspaceService.createLabel.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();
    component.newName = 'Failing Label';

    component.createLabel();

    // Rollback to original labels
    expect(component.labels()).toEqual(mockLabels);
    expect(component.newName).toBe('Failing Label');
    expect(component.errorMessage()).toBe('Failed to create label');
  });

  it('should start edit with label values', () => {
    fixture.detectChanges();

    component.startEdit(mockLabels[0]);

    expect(component.editingId()).toBe('lbl-1');
    expect(component.editName).toBe('Bug');
    expect(component.editColor).toBe('#ef4444');
  });

  it('should cancel edit', () => {
    component.startEdit(mockLabels[0]);
    component.cancelEdit();

    expect(component.editingId()).toBeNull();
  });

  it('should save edit optimistically and replace with server response', () => {
    fixture.detectChanges();
    component.startEdit(mockLabels[0]);
    component.editName = 'Critical Bug';
    component.editColor = '#dc2626';

    component.saveEdit('lbl-1');

    expect(mockWorkspaceService.updateLabel).toHaveBeenCalledWith(
      'ws-1',
      'lbl-1',
      'Critical Bug',
      '#dc2626',
    );
    expect(component.editingId()).toBeNull();
    const updated = component.labels().find((l) => l.id === 'lbl-1');
    expect(updated?.name).toBe('Critical Bug');
  });

  it('should not save edit with empty name', () => {
    component.editName = '   ';
    component.saveEdit('lbl-1');

    expect(mockWorkspaceService.updateLabel).not.toHaveBeenCalled();
  });

  it('should rollback on edit error', () => {
    mockWorkspaceService.updateLabel.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();
    component.startEdit(mockLabels[0]);
    component.editName = 'Failing Edit';

    component.saveEdit('lbl-1');

    // Rolls back to original
    expect(component.labels()[0].name).toBe('Bug');
    expect(component.errorMessage()).toBe('Failed to update label');
  });

  it('should delete label optimistically', () => {
    fixture.detectChanges();

    component.deleteLabel('lbl-1');

    expect(mockWorkspaceService.deleteLabel).toHaveBeenCalledWith('ws-1', 'lbl-1');
    expect(component.labels().length).toBe(1);
    expect(component.labels()[0].id).toBe('lbl-2');
  });

  it('should rollback on delete error', () => {
    mockWorkspaceService.deleteLabel.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    component.deleteLabel('lbl-1');

    expect(component.labels()).toEqual(mockLabels);
    expect(component.errorMessage()).toBe('Failed to delete label');
  });

  it('should expose presetColors', () => {
    expect(component.presetColors.length).toBeGreaterThan(0);
  });
});
