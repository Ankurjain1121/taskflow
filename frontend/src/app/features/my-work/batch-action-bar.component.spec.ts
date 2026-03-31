import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA, Component } from '@angular/core';

import { BatchActionBarComponent } from './batch-action-bar.component';

/**
 * Test host component that provides the required input signal.
 */
@Component({
  standalone: true,
  imports: [BatchActionBarComponent],
  template: `
    <app-batch-action-bar
      [selectedIds]="selectedIds"
      (cleared)="onCleared()"
      (updated)="onUpdated()"
    />
  `,
})
class TestHostComponent {
  selectedIds: string[] = [];
  clearedCalled = false;
  updatedCalled = false;

  onCleared() {
    this.clearedCalled = true;
  }
  onUpdated() {
    this.updatedCalled = true;
  }
}

describe('BatchActionBarComponent', () => {
  let hostFixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    hostFixture = TestBed.createComponent(TestHostComponent);
    host = hostFixture.componentInstance;
    hostFixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function getComponent(): BatchActionBarComponent {
    const debugEl = hostFixture.debugElement.children[0];
    return debugEl.componentInstance as BatchActionBarComponent;
  }

  it('should create', () => {
    expect(getComponent()).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have empty selectedIds by default', () => {
      expect(getComponent().selectedIds()).toEqual([]);
    });

    it('should not be processing', () => {
      expect(getComponent().processing()).toBe(false);
    });
  });

  describe('selectedIds input', () => {
    it('should reflect parent-provided selectedIds', () => {
      host.selectedIds = ['task-1', 'task-2'];
      hostFixture.detectChanges();
      expect(getComponent().selectedIds()).toEqual(['task-1', 'task-2']);
    });
  });

  describe('onPriorityChange()', () => {
    it('should send batch update with priority', async () => {
      host.selectedIds = ['task-1', 'task-2'];
      hostFixture.detectChanges();

      const selectEl = { value: 'high' } as HTMLSelectElement;
      const event = { target: selectEl } as unknown as Event;

      const promise = getComponent().onPriorityChange(event);

      const req = httpTesting.expectOne('/api/my-tasks/batch');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        updates: [
          { task_id: 'task-1', priority: 'high' },
          { task_id: 'task-2', priority: 'high' },
        ],
      });
      req.flush({ updated: 2, failed: [] });

      await promise;
      expect(selectEl.value).toBe('');
      expect(host.updatedCalled).toBe(true);
    });

    it('should skip when value is empty', async () => {
      host.selectedIds = ['task-1'];
      hostFixture.detectChanges();

      const event = { target: { value: '' } } as unknown as Event;
      await getComponent().onPriorityChange(event);

      httpTesting.expectNone('/api/my-tasks/batch');
    });
  });

  describe('onDueDateChange()', () => {
    it('should send batch update with due_date', async () => {
      host.selectedIds = ['task-1'];
      hostFixture.detectChanges();

      const event = { target: { value: '2026-05-15' } } as unknown as Event;
      const promise = getComponent().onDueDateChange(event);

      const req = httpTesting.expectOne('/api/my-tasks/batch');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.updates[0].task_id).toBe('task-1');
      expect(req.request.body.updates[0].due_date).toBeTruthy();
      req.flush({ updated: 1, failed: [] });

      await promise;
      expect(host.updatedCalled).toBe(true);
    });

    it('should skip when value is empty', async () => {
      host.selectedIds = ['task-1'];
      hostFixture.detectChanges();

      const event = { target: { value: '' } } as unknown as Event;
      await getComponent().onDueDateChange(event);

      httpTesting.expectNone('/api/my-tasks/batch');
    });
  });

  describe('onComplete()', () => {
    it('should send batch update with null due_date', async () => {
      host.selectedIds = ['task-1', 'task-3'];
      hostFixture.detectChanges();

      const promise = getComponent().onComplete();

      const req = httpTesting.expectOne('/api/my-tasks/batch');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.updates).toEqual([
        { task_id: 'task-1', due_date: null },
        { task_id: 'task-3', due_date: null },
      ]);
      req.flush({ updated: 2, failed: [] });

      await promise;
      expect(host.updatedCalled).toBe(true);
    });
  });

  describe('processing state', () => {
    it('should set processing to true during batch and false after', async () => {
      host.selectedIds = ['task-1'];
      hostFixture.detectChanges();
      const comp = getComponent();

      expect(comp.processing()).toBe(false);

      const promise = comp.onComplete();
      expect(comp.processing()).toBe(true);

      const req = httpTesting.expectOne('/api/my-tasks/batch');
      req.flush({ updated: 1, failed: [] });

      await promise;
      expect(comp.processing()).toBe(false);
    });

    it('should set processing to false on error', async () => {
      host.selectedIds = ['task-1'];
      hostFixture.detectChanges();
      const comp = getComponent();

      const promise = comp.onComplete();
      expect(comp.processing()).toBe(true);

      const req = httpTesting.expectOne('/api/my-tasks/batch');
      req.error(new ProgressEvent('error'));

      await promise;
      expect(comp.processing()).toBe(false);
    });
  });

  describe('cleared output', () => {
    it('should emit cleared when cancel is triggered', () => {
      host.selectedIds = ['task-1'];
      hostFixture.detectChanges();
      const comp = getComponent();

      comp.cleared.emit();
      expect(host.clearedCalled).toBe(true);
    });
  });
});
