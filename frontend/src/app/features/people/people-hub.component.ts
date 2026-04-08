import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  WorkspaceService,
  TenantMember,
  WorkspaceMatrixEntry,
} from '../../core/services/workspace.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

type RoleFilter = 'all' | 'admin' | 'manager' | 'member';

@Component({
  selector: 'app-people-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
      .member-row {
        transition: background var(--duration-fast, 150ms)
          var(--ease-standard, ease);
        cursor: pointer;
      }
      .member-row:hover {
        background: var(--accent-50);
      }
      :host-context(.dark) .member-row:hover {
        background: var(--accent-950);
      }
      .member-row.selected {
        background: var(--accent-100);
        border-left: 3px solid var(--primary);
      }
      :host-context(.dark) .member-row.selected {
        background: var(--accent-900);
      }
      .role-chip {
        transition: all var(--duration-fast, 150ms)
          var(--ease-standard, ease);
        cursor: pointer;
        user-select: none;
      }
      .role-chip:hover {
        opacity: 0.85;
      }
      .role-chip.active {
        background: var(--primary);
        color: white;
      }
      .ws-toggle-row {
        transition: background var(--duration-fast, 150ms)
          var(--ease-standard, ease);
      }
      .ws-toggle-row:hover {
        background: var(--muted);
      }
    `,
  ],
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <!-- Header -->
        <div
          class="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-50)] to-transparent dark:from-[var(--accent-950)] dark:to-transparent p-6 mb-6 shadow-sm"
        >
          <h1 class="font-display text-2xl font-bold text-[var(--foreground)]">People</h1>
          <p class="text-sm text-[var(--muted-foreground)] mt-1">
            View and manage organization members across workspaces
          </p>
        </div>

        <!-- Master-Detail Layout -->
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- Left Panel: Member List -->
          <div
            class="w-full lg:w-[40%] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden"
          >
            <!-- Search -->
            <div class="p-4 border-b border-[var(--border)]">
              <div class="relative">
                <i
                  class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-sm"
                ></i>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  class="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  [ngModel]="searchQuery()"
                  (ngModelChange)="onSearchInput($event)"
                />
              </div>

              <!-- Role Filter Chips -->
              <div class="flex gap-2 mt-3 flex-wrap">
                @for (filter of roleFilters; track filter.value) {
                  <button
                    class="role-chip px-3 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--foreground)]"
                    [class.active]="activeRoleFilter() === filter.value"
                    (click)="setRoleFilter(filter.value)"
                  >
                    {{ filter.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Member List -->
            <div class="max-h-[calc(100vh-320px)] overflow-y-auto">
              @if (loading()) {
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                    <div class="w-9 h-9 rounded-full bg-[var(--muted)] animate-pulse"></div>
                    <div class="flex-1">
                      <div class="h-4 w-32 bg-[var(--muted)] rounded animate-pulse mb-1"></div>
                      <div class="h-3 w-48 bg-[var(--muted)] rounded animate-pulse"></div>
                    </div>
                  </div>
                }
              } @else if (filteredMembers().length === 0) {
                <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <i class="pi pi-users text-3xl text-[var(--muted-foreground)] mb-3"></i>
                  <p class="text-sm text-[var(--muted-foreground)]">No members found</p>
                </div>
              } @else {
                @for (member of filteredMembers(); track member.user_id) {
                  <div
                    class="member-row flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]"
                    [class.selected]="selectedMemberId() === member.user_id"
                    (click)="selectMember(member)"
                  >
                    <!-- Avatar -->
                    @if (member.avatar_url) {
                      <img
                        [src]="member.avatar_url"
                        [alt]="member.name"
                        class="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      />
                    } @else {
                      <div
                        class="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                      >
                        {{ getInitials(member.name) }}
                      </div>
                    }

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-sm font-medium text-[var(--foreground)] truncate"
                          >{{ member.name }}</span
                        >
                        @if (member.is_org_admin) {
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[var(--accent-warm)]/10 text-[var(--accent-warm)]"
                            pTooltip="Has automatic access to all workspaces"
                            tooltipPosition="top"
                            >Org Admin</span
                          >
                        }
                      </div>
                      <p
                        class="text-xs text-[var(--muted-foreground)] truncate"
                      >
                        {{ member.email }}
                      </p>
                    </div>

                    <!-- Right Side: Role Badge + Workspace Count -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span
                        class="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        [class]="getRoleBadgeClass(member.role)"
                        >{{ member.role | titlecase }}</span
                      >
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
                        pTooltip="Workspaces"
                        tooltipPosition="top"
                        >{{ member.workspace_count }}</span
                      >
                    </div>
                  </div>
                }
              }
            </div>
          </div>

          <!-- Right Panel: Member Detail -->
          <div class="w-full lg:w-[60%]">
            @if (!selectedMember()) {
              <!-- Empty State -->
              <div
                class="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm flex flex-col items-center justify-center py-24 px-8"
              >
                <i
                  class="pi pi-user text-4xl text-[var(--muted-foreground)] mb-4"
                ></i>
                <p class="text-[var(--muted-foreground)] text-sm">
                  Select a member to view details
                </p>
              </div>
            } @else {
              <div
                class="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden"
              >
                <!-- Profile Header -->
                <div
                  class="p-6 border-b border-[var(--border)] bg-gradient-to-r from-[var(--accent-50)] to-transparent dark:from-[var(--accent-950)] dark:to-transparent"
                >
                  <div class="flex items-start gap-4">
                    @if (selectedMember()!.avatar_url) {
                      <img
                        [src]="selectedMember()!.avatar_url"
                        [alt]="selectedMember()!.name"
                        class="w-16 h-16 rounded-full object-cover flex-shrink-0"
                      />
                    } @else {
                      <div
                        class="w-16 h-16 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xl font-semibold flex-shrink-0"
                      >
                        {{ getInitials(selectedMember()!.name) }}
                      </div>
                    }
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h2
                          class="text-xl font-bold text-[var(--foreground)]"
                        >
                          {{ selectedMember()!.name }}
                        </h2>
                        @if (selectedMember()!.is_org_admin) {
                          <span
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-warm)]/10 text-[var(--accent-warm)]"
                            pTooltip="Has automatic access to all workspaces"
                            tooltipPosition="top"
                            >Org Admin</span
                          >
                        }
                      </div>
                      <p class="text-sm text-[var(--muted-foreground)] mt-0.5">
                        {{ selectedMember()!.email }}
                      </p>
                      <div
                        class="flex items-center gap-4 mt-2 text-xs text-[var(--muted-foreground)]"
                      >
                        @if (selectedMember()!.job_title) {
                          <span class="flex items-center gap-1">
                            <i class="pi pi-briefcase text-xs"></i>
                            {{ selectedMember()!.job_title }}
                          </span>
                        }
                        @if (selectedMember()!.department) {
                          <span class="flex items-center gap-1">
                            <i class="pi pi-building text-xs"></i>
                            {{ selectedMember()!.department }}
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Workspace Memberships -->
                <div class="p-6">
                  <h3
                    class="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2"
                  >
                    <i class="pi pi-th-large text-sm"></i>
                    Workspace Memberships
                  </h3>

                  @if (matrixLoading()) {
                    <div class="space-y-3">
                      @for (i of [1, 2, 3]; track i) {
                        <div
                          class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)]"
                        >
                          <div
                            class="w-5 h-5 rounded bg-[var(--muted)] animate-pulse"
                          ></div>
                          <div
                            class="h-4 w-40 bg-[var(--muted)] rounded animate-pulse"
                          ></div>
                        </div>
                      }
                    </div>
                  } @else if (workspaceMatrix().length === 0) {
                    <p class="text-sm text-[var(--muted-foreground)] py-4">
                      No workspaces found in this organization.
                    </p>
                  } @else {
                    <div class="space-y-2">
                      @for (
                        ws of workspaceMatrix();
                        track ws.workspace_id
                      ) {
                        <div
                          class="ws-toggle-row flex items-center gap-3 p-3 rounded-lg border border-[var(--border)]"
                        >
                          <input
                            type="checkbox"
                            [checked]="ws.is_member || ws.is_org_admin"
                            [disabled]="
                              ws.is_org_admin || togglingWorkspaces().has(ws.workspace_id)
                            "
                            (change)="
                              toggleMembership(ws, $event)
                            "
                            class="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] accent-[var(--primary)]"
                          />
                          <span
                            class="text-sm text-[var(--foreground)] flex-1"
                            >{{ ws.workspace_name }}</span
                          >
                          @if (ws.is_org_admin) {
                            <span
                              class="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-warm)]/10 text-[var(--accent-warm)]"
                              >Auto-access</span
                            >
                          } @else if (ws.is_member && ws.role) {
                            <span
                              class="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
                              >{{ ws.role | titlecase }}</span
                            >
                          }
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Quick Actions -->
                <div class="px-6 pb-6">
                  <h3
                    class="text-sm font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2"
                  >
                    <i class="pi pi-bolt text-sm"></i>
                    Quick Actions
                  </h3>
                  <div class="flex flex-wrap gap-2">
                    <a
                      [routerLink]="getMemberProfileLink()"
                      class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                    >
                      <i class="pi pi-user text-xs"></i>
                      View Profile
                    </a>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PeopleHubComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly ctx = inject(WorkspaceContextService);

  private readonly searchSubject = new Subject<string>();

  readonly loading = signal(false);
  readonly matrixLoading = signal(false);
  readonly searchQuery = signal('');
  readonly activeRoleFilter = signal<RoleFilter>('all');
  readonly members = signal<TenantMember[]>([]);
  readonly selectedMemberId = signal<string | null>(null);
  readonly workspaceMatrix = signal<WorkspaceMatrixEntry[]>([]);
  readonly togglingWorkspaces = signal<Set<string>>(new Set());

  readonly roleFilters: readonly { label: string; value: RoleFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Admin', value: 'admin' },
    { label: 'Manager', value: 'manager' },
    { label: 'Member', value: 'member' },
  ] as const;

  readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    if (!id) return null;
    return this.members().find((m) => m.user_id === id) ?? null;
  });

  readonly filteredMembers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const role = this.activeRoleFilter();

    return this.members().filter((m) => {
      const matchesSearch =
        !query ||
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query);
      const matchesRole = role === 'all' || m.role === role;
      return matchesSearch && matchesRole;
    });
  });

  ngOnInit(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        this.searchQuery.set(value);
      });

    this.loadMembers();
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  setRoleFilter(filter: RoleFilter): void {
    this.activeRoleFilter.set(filter);
  }

  selectMember(member: TenantMember): void {
    this.selectedMemberId.set(member.user_id);
    this.loadWorkspaceMatrix(member.user_id);
  }

  toggleMembership(
    ws: WorkspaceMatrixEntry,
    event: Event,
  ): void {
    const checkbox = event.target as HTMLInputElement;
    const add = checkbox.checked;
    const memberId = this.selectedMemberId();
    if (!memberId) return;

    const current = this.togglingWorkspaces();
    this.togglingWorkspaces.set(new Set([...current, ws.workspace_id]));

    this.workspaceService
      .toggleWorkspaceMembership(ws.workspace_id, memberId, add)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.workspaceMatrix.update((matrix) =>
            matrix.map((entry) =>
              entry.workspace_id === ws.workspace_id
                ? { ...entry, is_member: add }
                : entry,
            ),
          );
          this.removeTogglingWorkspace(ws.workspace_id);
        },
        error: () => {
          checkbox.checked = !add;
          this.removeTogglingWorkspace(ws.workspace_id);
        },
      });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-[var(--primary)]/10 text-[var(--primary)]';
      case 'manager':
        return 'bg-[var(--primary)]/10 text-[var(--primary)]';
      case 'member':
        return 'bg-[var(--success)]/10 text-[var(--success)]';
      default:
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
    }
  }

  getMemberProfileLink(): string {
    const wsId = this.ctx.activeWorkspaceId();
    const userId = this.selectedMemberId();
    if (!wsId || !userId) return '';
    return `/workspace/${wsId}/team/member/${userId}`;
  }

  private loadMembers(): void {
    this.loading.set(true);
    this.workspaceService
      .listTenantMembers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  private loadWorkspaceMatrix(userId: string): void {
    this.matrixLoading.set(true);
    this.workspaceMatrix.set([]);
    this.workspaceService
      .getWorkspaceMatrix(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (matrix) => {
          this.workspaceMatrix.set(matrix);
          this.matrixLoading.set(false);
        },
        error: () => {
          this.matrixLoading.set(false);
        },
      });
  }

  private removeTogglingWorkspace(workspaceId: string): void {
    this.togglingWorkspaces.update((current) => {
      const next = new Set(current);
      next.delete(workspaceId);
      return next;
    });
  }
}
