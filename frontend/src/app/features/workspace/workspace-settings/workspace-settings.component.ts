import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  WorkspaceService,
  Workspace,
  WorkspaceMember,
} from '../../../core/services/workspace.service';
import { BoardService, Board } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  MembersListComponent,
  MemberWithDetails,
} from '../members-list/members-list.component';

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MembersListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-[var(--foreground)]">
            Workspace Settings
          </h1>
          <p class="mt-2 text-[var(--muted-foreground)]">
            Manage your workspace settings and members
          </p>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <svg
              class="animate-spin h-8 w-8 text-primary"
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
        } @else if (workspace()) {
          <!-- General Settings -->
          <section class="mb-8">
            <div class="widget-card">
              <div class="px-6 py-4 border-b border-[var(--border)]">
                <h2 class="text-lg font-medium text-[var(--foreground)]">
                  General
                </h2>
              </div>
              <form
                [formGroup]="form"
                (ngSubmit)="onSave()"
                class="px-6 py-4 space-y-4"
              >
                <div>
                  <label
                    for="name"
                    class="block text-sm font-medium text-[var(--foreground)]"
                    >Name</label
                  >
                  <input
                    type="text"
                    id="name"
                    formControlName="name"
                    class="mt-1 block w-full rounded-md border-[var(--border)] shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
                  />
                  @if (
                    form.controls['name'].invalid &&
                    form.controls['name'].touched
                  ) {
                    <p class="mt-1 text-sm text-[var(--status-red-text)]">
                      Name is required
                    </p>
                  }
                </div>

                <div>
                  <label
                    for="slug"
                    class="block text-sm font-medium text-[var(--foreground)]"
                    >Slug</label
                  >
                  <input
                    type="text"
                    id="slug"
                    formControlName="slug"
                    class="mt-1 block w-full rounded-md border-[var(--border)] shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
                  />
                  <p class="mt-1 text-sm text-[var(--muted-foreground)]">
                    URL-friendly identifier for the workspace
                  </p>
                </div>

                <div class="flex justify-end pt-4">
                  <button
                    type="submit"
                    [disabled]="saving() || form.invalid || !form.dirty"
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    @if (saving()) {
                      <svg
                        class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                      Saving...
                    } @else {
                      Save Changes
                    }
                  </button>
                </div>
              </form>
            </div>
          </section>

          <!-- Members Section -->
          <section class="mb-8">
            <app-members-list
              [members]="members()"
              [workspaceId]="workspaceId"
              [boards]="boards()"
              (memberRemoved)="onMemberRemoved($event)"
              (memberRoleChanged)="onMemberRoleChanged($event)"
            ></app-members-list>
          </section>

          <!-- Danger Zone -->
          @if (isAdmin()) {
            <section>
              <div
                class="widget-card border-2 border-[var(--status-red-border)]"
              >
                <div
                  class="px-6 py-4 border-b border-[var(--status-red-border)] bg-[var(--status-red-bg)]"
                >
                  <h2 class="text-lg font-medium text-[var(--status-red-text)]">
                    Danger Zone
                  </h2>
                </div>
                <div class="px-6 py-4">
                  <div
                    class="flex items-center justify-between py-4 border-b border-[var(--border)] last:border-0"
                  >
                    <div>
                      <h3 class="text-sm font-medium text-[var(--foreground)]">
                        Delete Workspace
                      </h3>
                      <p class="text-sm text-[var(--muted-foreground)]">
                        Permanently delete this workspace and all its data. This
                        action cannot be undone.
                      </p>
                    </div>
                    <button
                      (click)="onDeleteWorkspace()"
                      [disabled]="deleting()"
                      class="inline-flex items-center px-4 py-2 border border-[var(--status-red-border)] text-sm font-medium rounded-md text-[var(--status-red-text)] bg-[var(--card)] hover:bg-[var(--status-red-bg)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      @if (deleting()) {
                        <svg
                          class="animate-spin -ml-1 mr-2 h-4 w-4"
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
                        Deleting...
                      } @else {
                        Delete Workspace
                      }
                    </button>
                  </div>
                </div>
              </div>
            </section>
          }
        } @else {
          <div class="text-center py-12">
            <p class="text-[var(--muted-foreground)]">Workspace not found</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class WorkspaceSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);
  private authService = inject(AuthService);

  workspaceId = '';

  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  workspace = signal<Workspace | null>(null);
  members = signal<MemberWithDetails[]>([]);
  boards = signal<{ id: string; name: string }[]>([]);

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    slug: [''],
  });

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.loadWorkspace();
    });
  }

  isAdmin(): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    const member = this.members().find((m) => m.user_id === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  }

  onSave(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    const { name, slug } = this.form.value;

    this.workspaceService.update(this.workspaceId, { name, slug }).subscribe({
      next: (updated) => {
        this.workspace.set(updated);
        this.form.markAsPristine();
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Failed to update workspace:', err);
        this.saving.set(false);
      },
    });
  }

  onDeleteWorkspace(): void {
    const workspace = this.workspace();
    if (!workspace) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    const doubleConfirmed = confirm(
      `Type the workspace name to confirm: ${workspace.name}`,
    );
    if (!doubleConfirmed) return;

    this.deleting.set(true);

    this.workspaceService.delete(this.workspaceId).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error('Failed to delete workspace:', err);
        this.deleting.set(false);
      },
    });
  }

  onMemberRemoved(userId: string): void {
    this.members.update((members) =>
      members.filter((m) => m.user_id !== userId),
    );
  }

  onMemberRoleChanged(event: { userId: string; role: string }): void {
    this.members.update((members) =>
      members.map((m) =>
        m.user_id === event.userId
          ? {
              ...m,
              role: event.role as 'admin' | 'manager' | 'member' | 'owner',
            }
          : m,
      ),
    );
  }

  private loadWorkspace(): void {
    this.loading.set(true);

    this.workspaceService.get(this.workspaceId).subscribe({
      next: (workspace) => {
        this.workspace.set(workspace);
        this.form.patchValue({
          name: workspace.name,
          slug: workspace.slug,
        });
        this.loadMembers();
        this.loadBoards();
      },
      error: (err) => {
        console.error('Failed to load workspace:', err);
        this.loading.set(false);
      },
    });
  }

  private loadMembers(): void {
    this.workspaceService.getMembers(this.workspaceId).subscribe({
      next: (members) => {
        // Map WorkspaceMemberInfo to MemberWithDetails
        this.members.set(
          members.map((m) => ({
            ...m,
            workspace_id: this.workspaceId,
            role: m.role as WorkspaceMember['role'],
            display_name: m.name,
            joined_at: m.joined_at || new Date().toISOString(),
          })),
        );
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load members:', err);
        this.loading.set(false);
      },
    });
  }

  private loadBoards(): void {
    this.boardService.listBoards(this.workspaceId).subscribe({
      next: (boards) => {
        this.boards.set(boards.map((b) => ({ id: b.id, name: b.name })));
      },
      error: (err) => {
        console.error('Failed to load boards:', err);
      },
    });
  }
}
