import {
  Component,
  input,
  output,
  signal,
  inject,
  DestroyRef,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { generateKeyBetween } from 'fractional-indexing';
import {
  CdkDropList,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  TaskService,
  Task,
  TaskPriority,
  ChildTaskListResponse,
} from '../../../core/services/task.service';
import { TaskCompletionService } from '../../../core/services/task-completion.service';
import {
  Column,
  ProjectMember,
  ProjectService,
} from '../../../core/services/project.service';
import {
  WorkspaceService,
  WorkspaceLabel,
} from '../../../core/services/workspace.service';
import { SubtaskRowComponent } from './subtask-row.component';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-subtask-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDropList,
    SubtaskRowComponent,
    Toast,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <div class="space-y-3">
      <!-- Header with progress -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg
            class="w-5 h-5 text-[var(--muted-foreground)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--card-foreground)]">
            Subtasks
          </h3>
        </div>
        @if (progress().total > 0) {
          <span class="text-xs text-[var(--muted-foreground)]">
            {{ progress().completed }}/{{ progress().total }} completed
          </span>
        }
      </div>

      <!-- Progress bar -->
      @if (progress().total > 0) {
        <div class="w-full bg-[var(--muted)] rounded-full h-1.5">
          <div
            class="h-1.5 rounded-full transition-all duration-300"
            [class]="progressPercent() === 100 ? 'bg-[var(--success)]' : 'bg-primary'"
            [style.width.%]="progressPercent()"
          ></div>
        </div>
      }

      <!-- Error banner -->
      @if (errorMessage()) {
        <div
          class="p-2 rounded-md text-xs text-[var(--status-red-text)] bg-[var(--status-red-bg)] border border-[var(--status-red-border)]"
        >
          {{ errorMessage() }}
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-4">
          <svg
            class="animate-spin h-5 w-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      } @else {
        <!-- Empty state -->
        @if (children().length === 0) {
          <div class="text-center py-4">
            <p class="text-sm text-[var(--muted-foreground)]">
              No subtasks yet. Break this task into smaller pieces to track progress.
            </p>
          </div>
        }

        <!-- Child task rows with drag-drop -->
        @if (children().length > 0) {
          <div
            cdkDropList
            (cdkDropListDropped)="onReorder($event)"
            class="space-y-0.5"
          >
            @for (child of children(); track child.id) {
              <app-subtask-row
                [child]="child"
                [boardColumns]="boardColumns()"
                [projectMembers]="projectMembers()"
                [workspaceLabels]="workspaceLabels()"
                (statusChanged)="onStatusChanged($event)"
                (priorityChanged)="onPriorityChanged($event)"
                (titleChanged)="onTitleChanged($event)"
                (assigneesChanged)="onAssigneesChanged($event)"
                (labelsChanged)="onLabelsChanged($event)"
                (dueDateChanged)="onDueDateChanged($event)"
                (deleted)="onDeleted($event)"
                (navigate)="onNavigate($event)"
              />
            }
          </div>
        }

        <!-- Enhanced add subtask form -->
        <div class="flex items-center gap-2 px-2 py-1.5 border-t border-[var(--border)] mt-1">
          <!-- Status selector for new subtask -->
          <select
            [ngModel]="newStatusId()"
            (ngModelChange)="newStatusId.set($event)"
            class="text-xs px-1.5 py-1 rounded-md bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] cursor-pointer"
          >
            @for (col of boardColumns(); track col.id) {
              <option [value]="col.id">{{ col.name }}</option>
            }
          </select>

          <!-- Priority selector for new subtask -->
          <select
            [ngModel]="newPriority()"
            (ngModelChange)="newPriority.set($event)"
            class="text-xs px-1.5 py-1 rounded-md bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] cursor-pointer"
          >
            <option value="none">No priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <!-- Title input -->
          <input
            type="text"
            [ngModel]="newSubtaskTitle()"
            (ngModelChange)="newSubtaskTitle.set($event)"
            (keydown.enter)="onAdd()"
            placeholder="Add a subtask..."
            class="flex-1 text-sm border-0 focus:ring-0 px-0 py-0 bg-transparent text-[var(--foreground)] placeholder-[var(--muted-foreground)]"
          />

          <!-- Add button -->
          <button
            (click)="onAdd()"
            [disabled]="!newSubtaskTitle().trim()"
            class="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
            [class]="newSubtaskTitle().trim()
              ? 'bg-primary text-[var(--primary-foreground)] hover:opacity-90'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'"
          >
            + Add
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @reference "tailwindcss";
      .cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
      .cdk-drop-list-dragging .cdk-drag {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class SubtaskListComponent implements OnInit, OnChanges {
  private taskService = inject(TaskService);
  private taskCompletion = inject(TaskCompletionService);
  private projectService = inject(ProjectService);
  private workspaceService = inject(WorkspaceService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private taskId$ = new Subject<string>();

  taskId = input.required<string>();
  boardColumns = input<Column[]>([]);
  projectId = input<string>('');
  workspaceId = input<string>('');
  childrenLoaded = output<number>();

  loading = signal(true);
  children = signal<Task[]>([]);
  progress = signal<{ completed: number; total: number }>({ completed: 0, total: 0 });
  newSubtaskTitle = signal('');
  newStatusId = signal('');
  newPriority = signal<string>('none');
  errorMessage = signal<string | null>(null);
  projectMembers = signal<ProjectMember[]>([]);
  workspaceLabels = signal<WorkspaceLabel[]>([]);

  ngOnInit(): void {
    this.taskId$.pipe(
      switchMap(id => this.loadChildrenForId(id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (response) => {
        this.children.set(response.children);
        this.progress.set(response.progress);
        this.childrenLoaded.emit(response.children.length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showError('Failed to load subtasks');
      },
    });
    this.taskId$.next(this.taskId());

    // Set default status for new subtask (first non-done column)
    this.initDefaultStatus();

    // Load project members and workspace labels
    this.loadProjectMembers();
    this.loadWorkspaceLabels();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && !changes['taskId'].firstChange) {
      this.taskId$.next(this.taskId());
    }
    if (changes['projectId'] && !changes['projectId'].firstChange) {
      this.loadProjectMembers();
    }
    if (changes['workspaceId'] && !changes['workspaceId'].firstChange) {
      this.loadWorkspaceLabels();
    }
    if (changes['boardColumns']) {
      this.initDefaultStatus();
    }
  }

  progressPercent(): number {
    const p = this.progress();
    if (p.total === 0) return 0;
    return Math.round((p.completed / p.total) * 100);
  }

  // --- Event handlers for SubtaskRowComponent ---

  onStatusChanged(event: { childId: string; statusId: string }): void {
    const snapshot = this.children();
    const child = snapshot.find(c => c.id === event.childId);
    if (!child) return;
    const targetCol = this.boardColumns().find(c => c.id === event.statusId);
    const isDone = targetCol?.status_mapping?.done === true;
    this.children.update(list =>
      list.map(c => c.id === event.childId ? { ...c, status_id: event.statusId } : c),
    );
    this.taskCompletion
      .moveToStatus(event.childId, event.statusId, child.position, { isDone, silent: true })
      .subscribe({
        next: () => this.loadChildren(),
        error: () => {
          this.children.set(snapshot);
          this.showToast('Failed to update status');
        },
      });
  }

  onPriorityChanged(event: { childId: string; priority: TaskPriority | null }): void {
    const priority = event.priority ?? ('none' as TaskPriority);
    const snapshot = this.children();
    this.children.update(list =>
      list.map(c => c.id === event.childId ? { ...c, priority } : c),
    );
    this.taskService.updateTask(event.childId, { priority } as Record<string, unknown>).subscribe({
      error: () => {
        this.children.set(snapshot);
        this.showToast('Failed to update priority');
      },
    });
  }

  onTitleChanged(event: { childId: string; title: string }): void {
    const snapshot = this.children();
    this.children.update(list =>
      list.map(c => c.id === event.childId ? { ...c, title: event.title } : c),
    );
    this.taskService.updateTask(event.childId, { title: event.title }).subscribe({
      error: () => {
        this.children.set(snapshot);
        this.showToast('Failed to update title');
      },
    });
  }

  onAssigneesChanged(event: { childId: string; assigneeIds: string[] }): void {
    const child = this.children().find(c => c.id === event.childId);
    if (!child) return;

    const currentIds = new Set((child.assignees ?? []).map(a => a.id));
    const newIds = new Set(event.assigneeIds);

    // Find additions and removals
    const toAdd = event.assigneeIds.filter(id => !currentIds.has(id));
    const toRemove = [...currentIds].filter(id => !newIds.has(id));

    const ops = [
      ...toAdd.map(id => this.taskService.assignUser(event.childId, id)),
      ...toRemove.map(id => this.taskService.unassignUser(event.childId, id)),
    ];

    if (ops.length === 0) return;

    forkJoin(ops).subscribe({
      next: () => this.loadChildren(),
      error: () => this.showToast('Failed to update assignees'),
    });
  }

  onLabelsChanged(event: { childId: string; labelIds: string[] }): void {
    const child = this.children().find(c => c.id === event.childId);
    if (!child) return;

    const currentIds = new Set((child.labels ?? []).map(l => l.id));
    const newIds = new Set(event.labelIds);

    const toAdd = event.labelIds.filter(id => !currentIds.has(id));
    const toRemove = [...currentIds].filter(id => !newIds.has(id));

    const ops = [
      ...toAdd.map(id => this.taskService.addLabel(event.childId, id)),
      ...toRemove.map(id => this.taskService.removeLabel(event.childId, id)),
    ];

    if (ops.length === 0) return;

    forkJoin(ops).subscribe({
      next: () => this.loadChildren(),
      error: () => this.showToast('Failed to update labels'),
    });
  }

  onDueDateChanged(event: { childId: string; dueDate: string | null }): void {
    const snapshot = this.children();
    this.children.update(list =>
      list.map(c => c.id === event.childId ? { ...c, due_date: event.dueDate } : c),
    );
    const updates = event.dueDate
      ? { due_date: event.dueDate }
      : { clear_due_date: true };
    this.taskService.updateTask(event.childId, updates).subscribe({
      error: () => {
        this.children.set(snapshot);
        this.showToast('Failed to update due date');
      },
    });
  }

  onDeleted(childId: string): void {
    const snapshot = this.children();
    const snapshotProgress = this.progress();

    this.children.update(list => list.filter(c => c.id !== childId));
    this.progress.update(p => ({
      completed: p.completed,
      total: p.total - 1,
    }));

    this.taskService.deleteTask(childId).subscribe({
      next: () => this.loadChildren(),
      error: () => {
        this.children.set(snapshot);
        this.progress.set(snapshotProgress);
        this.showToast('Failed to delete subtask');
      },
    });
  }

  onNavigate(childId: string): void {
    this.router.navigate(['/task', childId]);
  }

  onAdd(): void {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;

    const savedTitle = title;
    this.newSubtaskTitle.set('');

    this.taskService.createChild(this.taskId(), {
      title,
      status_id: this.newStatusId() || undefined,
      priority: this.newPriority() as TaskPriority || undefined,
    }).subscribe({
      next: () => this.loadChildren(),
      error: () => {
        this.newSubtaskTitle.set(savedTitle);
        this.showError('Failed to add subtask');
      },
    });
  }

  onReorder(event: CdkDragDrop<Task[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const snapshot = [...this.children()];
    const items = [...this.children()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.children.set(items);

    const moved = items[event.currentIndex];
    const prev = event.currentIndex > 0 ? items[event.currentIndex - 1] : null;
    const next = event.currentIndex < items.length - 1 ? items[event.currentIndex + 1] : null;

    let newPosition: string;
    try {
      const prevPos = prev?.position ?? null;
      const nextPos = next?.position ?? null;
      newPosition = generateKeyBetween(prevPos, nextPos);
    } catch {
      newPosition = prev ? prev.position + 'a' : 'a0';
    }

    this.taskService.moveTask(moved.id, { status_id: moved.status_id ?? undefined, position: newPosition }).subscribe({
      error: () => {
        this.children.set(snapshot);
        this.showError('Failed to reorder');
      },
    });
  }

  private initDefaultStatus(): void {
    const cols = this.boardColumns();
    if (cols.length > 0 && !this.newStatusId()) {
      // Pick first non-done column, or first column
      const nonDone = cols.find(c => c.status_mapping?.done !== true);
      this.newStatusId.set(nonDone?.id ?? cols[0].id);
    }
  }

  private loadProjectMembers(): void {
    const pid = this.projectId();
    if (!pid) return;
    this.projectService.getProjectMembers(pid).subscribe({
      next: (members) => this.projectMembers.set(members),
      error: () => this.showToast('Failed to load project members'),
    });
  }

  private loadWorkspaceLabels(): void {
    const wsId = this.workspaceId();
    if (!wsId) return;
    this.workspaceService.listLabels(wsId).subscribe({
      next: (labels) => this.workspaceLabels.set(labels),
      error: () => this.showToast('Failed to load labels'),
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  private showToast(detail: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail,
      life: 4000,
    });
  }

  private loadChildrenForId(taskId: string) {
    this.loading.set(true);
    return this.taskService.listChildren(taskId);
  }

  private loadChildren(): void {
    this.taskId$.next(this.taskId());
  }
}
