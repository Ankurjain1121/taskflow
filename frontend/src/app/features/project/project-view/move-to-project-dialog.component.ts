import {
  Component,
  input,
  output,
  signal,
  inject,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import {
  ProjectService,
  Board,
  ProjectStatus,
} from '../../../core/services/project.service';
import {
  WorkspaceStateService,
} from '../../../core/services/workspace-state.service';
import { take, forkJoin, of } from 'rxjs';

export interface MoveToProjectResult {
  taskId: string;
  targetProjectId: string;
  targetProjectName: string;
  targetStatusId: string;
  position: string;
}

@Component({
  selector: 'app-move-to-project-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, Select, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Move to Project"
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '420px' }"
      [closable]="true"
    >
      <div class="space-y-4">
        <!-- Project Selector -->
        <div>
          <label
            class="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >Target Project</label
          >
          <p-select
            [options]="availableProjects()"
            [(ngModel)]="selectedProjectId"
            (ngModelChange)="onProjectSelected($event)"
            optionLabel="name"
            optionValue="id"
            placeholder="Select a project..."
            styleClass="w-full"
            [filter]="true"
            filterPlaceholder="Search projects..."
          />
        </div>

        <!-- Status Selector -->
        @if (selectedProjectId) {
          <div>
            <label
              class="block text-sm font-medium text-[var(--foreground)] mb-1.5"
              >Target Status</label
            >
            @if (loadingStatuses()) {
              <div
                class="flex items-center gap-2 text-sm text-[var(--muted-foreground)] py-2"
              >
                <i class="pi pi-spin pi-spinner"></i>
                Loading statuses...
              </div>
            } @else {
              <p-select
                [options]="targetStatuses()"
                [(ngModel)]="selectedStatusId"
                optionLabel="name"
                optionValue="id"
                placeholder="Select a status..."
                styleClass="w-full"
              />
            }
          </div>
        }

        <!-- Warning -->
        @if (selectedProjectId) {
          <div
            class="flex items-start gap-2 p-3 rounded-lg text-xs"
            style="
              background: color-mix(in srgb, var(--status-amber-bg) 50%, transparent);
              color: var(--status-amber-text);
            "
          >
            <i class="pi pi-exclamation-triangle mt-0.5 flex-shrink-0"></i>
            <span
              >Labels will be removed when moving to another project. Subtasks
              will be moved with the parent task.</span
            >
          </div>
        }
      </div>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            severity="secondary"
            (click)="onCancel()"
          />
          <p-button
            label="Move Task"
            icon="pi pi-share-alt"
            [disabled]="!canConfirm()"
            [loading]="moving()"
            (click)="onConfirm()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class MoveToProjectDialogComponent {
  private projectService = inject(ProjectService);
  private workspaceState = inject(WorkspaceStateService);

  visible = input.required<boolean>();
  taskId = input.required<string | null>();
  currentProjectId = input.required<string>();

  confirmed = output<MoveToProjectResult>();
  cancelled = output<void>();

  selectedProjectId: string | null = null;
  selectedStatusId: string | null = null;

  allProjects = signal<Board[]>([]);
  targetStatuses = signal<ProjectStatus[]>([]);
  loadingStatuses = signal(false);
  moving = signal(false);

  readonly availableProjects = computed(() =>
    this.allProjects().filter((p) => p.id !== this.currentProjectId()),
  );

  readonly canConfirm = computed(
    () =>
      !!this.selectedProjectId &&
      !!this.selectedStatusId &&
      !this.loadingStatuses() &&
      !this.moving(),
  );

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.loadProjects();
        this.selectedProjectId = null;
        this.selectedStatusId = null;
        this.targetStatuses.set([]);
      }
    });
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.cancelled.emit();
    }
  }

  onProjectSelected(projectId: string): void {
    this.selectedStatusId = null;
    if (!projectId) {
      this.targetStatuses.set([]);
      return;
    }
    this.loadingStatuses.set(true);
    this.projectService
      .listStatuses(projectId)
      .pipe(take(1))
      .subscribe({
        next: (statuses) => {
          this.targetStatuses.set(statuses);
          const defaultStatus = statuses.find((s) => s.is_default);
          if (defaultStatus) {
            this.selectedStatusId = defaultStatus.id;
          } else if (statuses.length > 0) {
            this.selectedStatusId = statuses[0].id;
          }
          this.loadingStatuses.set(false);
        },
        error: () => {
          this.loadingStatuses.set(false);
        },
      });
  }

  onConfirm(): void {
    const tid = this.taskId();
    if (!tid || !this.selectedProjectId || !this.selectedStatusId) return;

    const project = this.allProjects().find(
      (p) => p.id === this.selectedProjectId,
    );

    this.confirmed.emit({
      taskId: tid,
      targetProjectId: this.selectedProjectId,
      targetProjectName: project?.name ?? 'Unknown',
      targetStatusId: this.selectedStatusId,
      position: 'a0',
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private loadProjects(): void {
    const workspaces = this.workspaceState.workspaces();
    if (workspaces.length === 0) return;

    const requests = workspaces.map((ws) =>
      this.projectService.listBoards(ws.id),
    );

    forkJoin(requests.length > 0 ? requests : [of([])])
      .pipe(take(1))
      .subscribe({
        next: (results) => {
          this.allProjects.set(results.flat());
        },
      });
  }
}
