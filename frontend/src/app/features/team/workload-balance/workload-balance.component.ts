import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  TeamService,
  MemberWorkload,
  MemberTask,
} from '../../../core/services/team.service';

@Component({
  selector: 'app-workload-balance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-[var(--card-foreground)]">
            Workload Balance
          </h1>
          <p class="text-sm text-[var(--muted-foreground)] mt-1">
            View member tasks and reassign work to balance the team
          </p>
        </div>

        @if (error()) {
          <div
            class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between"
          >
            <span>{{ error() }}</span>
            <button
              (click)="error.set(null)"
              class="text-red-500 hover:text-red-700 ml-2"
            >
              &times;
            </button>
          </div>
        }

        @if (loadingMembers()) {
          <div class="space-y-4">
            @for (i of [1, 2, 3]; track i) {
              <div
                class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
              >
                <div class="skeleton skeleton-text w-32 mb-2"></div>
                <div class="skeleton skeleton-text w-20"></div>
              </div>
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Members List -->
            <div class="lg:col-span-1">
              <div
                class="bg-[var(--card)] rounded-xl border border-[var(--border)]"
              >
                <div class="px-4 py-3 border-b border-[var(--border)]">
                  <h2
                    class="text-sm font-semibold text-[var(--card-foreground)]"
                  >
                    Team Members
                  </h2>
                </div>
                <div class="divide-y divide-[var(--border)]">
                  @for (member of members(); track member.user_id) {
                    <button
                      [attr.aria-label]="'View tasks for ' + member.user_name"
                      (click)="selectMember(member)"
                      [ngClass]="{
                        'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--muted)] transition-colors': true,
                        'bg-primary/5 border-l-2 border-l-primary':
                          selectedMember()?.user_id === member.user_id,
                      }"
                    >
                      <div
                        class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0"
                      >
                        {{ getInitials(member.user_name) }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-medium text-[var(--card-foreground)] truncate"
                        >
                          {{ member.user_name }}
                        </p>
                        <p class="text-xs text-[var(--muted-foreground)]">
                          {{ member.active_tasks }} active
                          @if (member.overdue_tasks > 0) {
                            <span class="text-red-500">
                              / {{ member.overdue_tasks }} overdue
                            </span>
                          }
                        </p>
                      </div>
                      @if (member.is_overloaded) {
                        <span
                          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700"
                        >
                          Overloaded
                        </span>
                      }
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Task List & Reassign Panel -->
            <div class="lg:col-span-2">
              @if (!selectedMember()) {
                <div
                  class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-12 text-center"
                >
                  <svg
                    class="mx-auto h-10 w-10 text-[var(--muted-foreground)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  <p class="mt-3 text-sm text-[var(--muted-foreground)]">
                    Select a team member to view their tasks
                  </p>
                </div>
              } @else {
                <!-- Selected Member Header -->
                <div
                  class="bg-[var(--card)] rounded-xl border border-[var(--border)] mb-4"
                >
                  <div
                    class="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between"
                  >
                    <div>
                      <h2
                        class="text-sm font-semibold text-[var(--card-foreground)]"
                      >
                        {{ selectedMember()!.user_name }}'s Tasks
                      </h2>
                      <p class="text-xs text-[var(--muted-foreground)]">
                        {{ memberTasks().length }} tasks found
                      </p>
                    </div>
                    @if (selectedTaskIds().length > 0) {
                      <div class="flex items-center gap-2">
                        <select
                          [(ngModel)]="targetMemberId"
                          class="text-xs rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="">Reassign to...</option>
                          @for (m of reassignTargets(); track m.user_id) {
                            <option [value]="m.user_id">
                              {{ m.user_name }} ({{ m.active_tasks }}
                              active)
                            </option>
                          }
                        </select>
                        <button
                          (click)="onReassign()"
                          [disabled]="!targetMemberId || reassigning()"
                          class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:brightness-90 disabled:opacity-50 transition-all"
                        >
                          @if (reassigning()) {
                            Reassigning...
                          } @else {
                            Reassign
                            {{ selectedTaskIds().length }}
                            {{
                              selectedTaskIds().length === 1 ? 'task' : 'tasks'
                            }}
                          }
                        </button>
                      </div>
                    }
                  </div>

                  @if (loadingTasks()) {
                    <div class="px-4 py-8 text-center">
                      <p class="text-sm text-[var(--muted-foreground)]">
                        Loading tasks...
                      </p>
                    </div>
                  } @else if (memberTasks().length === 0) {
                    <div class="px-4 py-8 text-center">
                      <p class="text-sm text-[var(--muted-foreground)]">
                        This member has no active tasks.
                      </p>
                    </div>
                  } @else {
                    <div class="divide-y divide-[var(--border)]">
                      @for (task of memberTasks(); track task.task_id) {
                        <label
                          class="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            [checked]="isTaskSelected(task.task_id)"
                            (change)="toggleTask(task.task_id)"
                            class="w-4 h-4 rounded border-[var(--border)] text-primary focus:ring-primary/50"
                          />
                          <div class="flex-1 min-w-0">
                            <p
                              class="text-sm font-medium text-[var(--card-foreground)] truncate"
                            >
                              {{ task.title }}
                            </p>
                            <div class="flex items-center gap-2 mt-0.5">
                              <span
                                class="text-xs text-[var(--muted-foreground)]"
                              >
                                {{ task.board_name }} / {{ task.column_name }}
                              </span>
                              @if (task.priority) {
                                <span
                                  [class]="
                                    'text-[10px] font-medium px-1.5 py-0.5 rounded ' +
                                    getPriorityClass(task.priority)
                                  "
                                >
                                  {{ task.priority }}
                                </span>
                              }
                            </div>
                          </div>
                          @if (task.due_date) {
                            <span
                              class="text-xs text-[var(--muted-foreground)] flex-shrink-0"
                              [class.text-red-500]="isOverdue(task.due_date)"
                            >
                              Due {{ formatDate(task.due_date) }}
                            </span>
                          }
                        </label>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Confirmation Dialog -->
    @if (showConfirmDialog()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div
          class="bg-[var(--card)] rounded-xl shadow-lg p-6 max-w-md w-full mx-4"
        >
          <h3 class="text-lg font-semibold text-[var(--card-foreground)] mb-2">
            Confirm Reassignment
          </h3>
          <p class="text-sm text-[var(--muted-foreground)] mb-4">
            Reassign {{ selectedTaskIds().length }}
            {{ selectedTaskIds().length === 1 ? 'task' : 'tasks' }} from
            {{ selectedMember()!.user_name }} to {{ getTargetMemberName() }}?
          </p>
          <div class="flex justify-end gap-2">
            <button
              (click)="showConfirmDialog.set(false)"
              class="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--secondary)] rounded-md hover:bg-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              (click)="confirmReassign()"
              [disabled]="reassigning()"
              class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:brightness-90 disabled:opacity-50"
            >
              @if (reassigning()) {
                Reassigning...
              } @else {
                Confirm
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class WorkloadBalanceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private teamService = inject(TeamService);

  workspaceId = '';

  loadingMembers = signal(true);
  loadingTasks = signal(false);
  reassigning = signal(false);
  showConfirmDialog = signal(false);
  error = signal<string | null>(null);

  members = signal<MemberWorkload[]>([]);
  selectedMember = signal<MemberWorkload | null>(null);
  memberTasks = signal<MemberTask[]>([]);
  selectedTaskIds = signal<string[]>([]);
  targetMemberId: string = '';

  reassignTargets = computed(() => {
    const selected = this.selectedMember();
    if (!selected) return [];
    return this.members().filter((m) => m.user_id !== selected.user_id);
  });

  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.workspaceId = params['workspaceId'];
        this.loadMembers();
      });
  }

  loadMembers(): void {
    this.loadingMembers.set(true);
    this.error.set(null);
    this.teamService.getTeamWorkload(this.workspaceId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loadingMembers.set(false);
      },
      error: () => {
        this.error.set('Failed to load team workload. Please try again.');
        this.loadingMembers.set(false);
      },
    });
  }

  selectMember(member: MemberWorkload): void {
    this.selectedMember.set(member);
    this.selectedTaskIds.set([]);
    this.targetMemberId = '';
    this.loadMemberTasks(member.user_id);
  }

  loadMemberTasks(userId: string): void {
    this.loadingTasks.set(true);
    this.error.set(null);
    this.teamService.getMemberTasks(this.workspaceId, userId).subscribe({
      next: (tasks) => {
        this.memberTasks.set(tasks);
        this.loadingTasks.set(false);
      },
      error: () => {
        this.error.set('Failed to load member tasks. Please try again.');
        this.memberTasks.set([]);
        this.loadingTasks.set(false);
      },
    });
  }

  toggleTask(taskId: string): void {
    this.selectedTaskIds.update((ids) =>
      ids.includes(taskId)
        ? ids.filter((id) => id !== taskId)
        : [...ids, taskId],
    );
  }

  isTaskSelected(taskId: string): boolean {
    return this.selectedTaskIds().includes(taskId);
  }

  onReassign(): void {
    if (!this.targetMemberId || this.selectedTaskIds().length === 0) return;
    this.showConfirmDialog.set(true);
  }

  confirmReassign(): void {
    const selected = this.selectedMember();
    if (!selected || !this.targetMemberId) return;

    this.reassigning.set(true);

    this.teamService
      .reassignTasks(
        this.workspaceId,
        this.selectedTaskIds(),
        selected.user_id,
        this.targetMemberId,
      )
      .subscribe({
        next: () => {
          this.reassigning.set(false);
          this.showConfirmDialog.set(false);
          this.selectedTaskIds.set([]);
          this.targetMemberId = '';
          // Reload data
          this.loadMembers();
          this.loadMemberTasks(selected.user_id);
        },
        error: () => {
          this.error.set('Failed to reassign tasks. Please try again.');
          this.reassigning.set(false);
          this.showConfirmDialog.set(false);
        },
      });
  }

  getTargetMemberName(): string {
    const target = this.members().find(
      (m) => m.user_id === this.targetMemberId,
    );
    return target?.user_name || 'selected member';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getPriorityClass(priority: string): string {
    const classes: Record<string, string> = {
      urgent: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
    };
    return classes[priority.toLowerCase()] || 'bg-gray-100 text-gray-600';
  }

  isOverdue(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
