import {
  Component,
  input,
  signal,
  inject,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  ProjectService,
  ProjectStatus,
} from '../../../core/services/project.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-board-workflow-settings',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <section>
        <div class="bg-[var(--card)] shadow rounded-lg">
          <div class="px-6 py-4 border-b border-[var(--border)]">
            <h2 class="text-lg font-medium text-[var(--foreground)]">
              Status Transitions
            </h2>
            <p class="text-sm text-[var(--muted-foreground)] mt-1">
              Control which status transitions are allowed. Unchecking
              a cell prevents moving tasks from that row's status to
              that column's status.
            </p>
          </div>
          <div class="px-6 py-4">
            @if (workflowLoading()) {
              <div class="flex items-center justify-center py-8">
                <svg class="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            } @else if (workflowStatuses().length === 0) {
              <p class="text-sm text-[var(--muted-foreground)]">No statuses found.</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-[var(--muted-foreground)]">
                        From \\ To
                      </th>
                      @for (col of workflowStatuses(); track col.id) {
                        <th class="px-3 py-2 text-center font-medium text-[var(--muted-foreground)] min-w-[80px]">
                          <span class="inline-block w-2.5 h-2.5 rounded-full mr-1" [style.background]="col.color"></span>
                          {{ col.name }}
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of workflowStatuses(); track row.id) {
                      <tr class="border-t border-[var(--border)]">
                        <td class="px-3 py-2 font-medium text-[var(--foreground)] whitespace-nowrap">
                          <span class="inline-block w-2.5 h-2.5 rounded-full mr-1" [style.background]="row.color"></span>
                          {{ row.name }}
                        </td>
                        @for (col of workflowStatuses(); track col.id) {
                          <td class="px-3 py-2 text-center">
                            @if (row.id === col.id) {
                              <span class="text-[var(--muted-foreground)]">&mdash;</span>
                            } @else {
                              <input
                                type="checkbox"
                                [checked]="isTransitionAllowed(row.id, col.id)"
                                (change)="toggleTransition(row.id, col.id)"
                                class="w-4 h-4 rounded border-[var(--border)] text-primary focus:ring-primary cursor-pointer"
                              />
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="mt-4 flex items-center gap-3">
                <button
                  (click)="saveWorkflow()"
                  [disabled]="workflowSaving()"
                  class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  @if (workflowSaving()) {
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  } @else {
                    Save Transitions
                  }
                </button>
                <button
                  (click)="resetWorkflowToAllowAll()"
                  class="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--accent)] transition-colors"
                >
                  Allow All
                </button>
              </div>
            }
          </div>
        </div>
      </section>
    </div>
  `,
})
export class BoardWorkflowSettingsComponent {
  private projectService = inject(ProjectService);
  private messageService = inject(MessageService);
  private destroyRef = inject(DestroyRef);

  boardId = input.required<string>();

  workflowStatuses = signal<ProjectStatus[]>([]);
  workflowLoading = signal(false);
  workflowSaving = signal(false);
  /** Map from status ID to its set of allowed target status IDs. null = allow all */
  transitionMap = signal<Record<string, string[] | null>>({});

  loadWorkflow(): void {
    this.workflowLoading.set(true);
    this.projectService
      .listStatuses(this.boardId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (statuses) => {
          this.workflowStatuses.set(statuses);
          const map: Record<string, string[] | null> = {};
          for (const s of statuses) {
            map[s.id] = s.allowed_transitions ?? null;
          }
          this.transitionMap.set(map);
          this.workflowLoading.set(false);
        },
        error: () => {
          this.workflowLoading.set(false);
        },
      });
  }

  isTransitionAllowed(fromId: string, toId: string): boolean {
    const allowed = this.transitionMap()[fromId];
    if (allowed === null || allowed === undefined) {
      return true; // null = allow all
    }
    return allowed.includes(toId);
  }

  toggleTransition(fromId: string, toId: string): void {
    const current = { ...this.transitionMap() };
    let allowed = current[fromId];
    const allOtherIds = this.workflowStatuses()
      .filter((s) => s.id !== fromId)
      .map((s) => s.id);

    if (allowed === null || allowed === undefined) {
      // Currently allow-all; toggling one off means: all except toId
      allowed = allOtherIds.filter((id) => id !== toId);
    } else if (allowed.includes(toId)) {
      // Remove it
      allowed = allowed.filter((id) => id !== toId);
    } else {
      // Add it
      allowed = [...allowed, toId];
    }

    // If all are allowed, set back to null
    if (allowed.length >= allOtherIds.length) {
      allowed = null;
    }

    current[fromId] = allowed;
    this.transitionMap.set(current);
  }

  saveWorkflow(): void {
    this.workflowSaving.set(true);
    const map = this.transitionMap();
    const calls = this.workflowStatuses().map((s) =>
      this.projectService.updateTransitions(s.id, map[s.id] ?? null),
    );

    if (calls.length === 0) {
      this.workflowSaving.set(false);
      return;
    }

    forkJoin(calls)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.workflowSaving.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Workflow transitions updated',
          });
        },
        error: () => {
          this.workflowSaving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to save transitions',
          });
        },
      });
  }

  resetWorkflowToAllowAll(): void {
    const map: Record<string, string[] | null> = {};
    for (const s of this.workflowStatuses()) {
      map[s.id] = null;
    }
    this.transitionMap.set(map);
  }
}
