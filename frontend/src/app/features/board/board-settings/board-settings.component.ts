import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  Validators,
} from '@angular/forms';
import { BoardService, Board, BoardMember } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import { ColumnManagerComponent } from '../column-manager/column-manager.component';
import {
  InviteMemberDialogComponent,
  InviteMemberDialogResult,
} from './invite-member-dialog.component';

@Component({
  selector: 'app-board-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, ColumnManagerComponent, InviteMemberDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-100">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          <nav class="text-sm text-gray-500 mb-2">
            <a
              [routerLink]="['/workspace', workspaceId, 'board', boardId]"
              class="hover:text-indigo-600"
              >Back to Board</a
            >
          </nav>
          <h1 class="text-3xl font-bold text-gray-900">Board Settings</h1>
          <p class="mt-2 text-gray-600">
            Configure your board's settings, columns, and members
          </p>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <svg
              class="animate-spin h-8 w-8 text-indigo-600"
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
        } @else if (board()) {
          <!-- General Settings -->
          <section class="mb-8">
            <div class="bg-white shadow rounded-lg">
              <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-medium text-gray-900">General</h2>
              </div>
              <form
                [formGroup]="form"
                (ngSubmit)="onSave()"
                class="px-6 py-4 space-y-4"
              >
                <div>
                  <label
                    for="name"
                    class="block text-sm font-medium text-gray-700"
                    >Name</label
                  >
                  <input
                    type="text"
                    id="name"
                    formControlName="name"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  @if (
                    form.controls['name'].invalid &&
                    form.controls['name'].touched
                  ) {
                    <p class="mt-1 text-sm text-red-600">Name is required</p>
                  }
                </div>

                <div>
                  <label
                    for="description"
                    class="block text-sm font-medium text-gray-700"
                    >Description</label
                  >
                  <textarea
                    id="description"
                    formControlName="description"
                    rows="3"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Add a description for this board..."
                  ></textarea>
                </div>

                <div class="flex justify-end pt-4">
                  <button
                    type="submit"
                    [disabled]="saving() || form.invalid || !form.dirty"
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

          <!-- Columns Section -->
          <section class="mb-8">
            <app-column-manager [boardId]="boardId"></app-column-manager>
          </section>

          <!-- Members Section -->
          <section class="mb-8">
            <div class="bg-white shadow rounded-lg">
              <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-medium text-gray-900">
                    Board Members
                  </h3>
                  <button
                    (click)="onInviteMember()"
                    class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                    Add Member
                  </button>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th
                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Member
                      </th>
                      <th
                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Role
                      </th>
                      <th
                        class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    @for (member of members(); track member.user_id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="flex items-center gap-3">
                            <div
                              class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600"
                            >
                              @if (member.avatar_url) {
                                <img
                                  [src]="member.avatar_url"
                                  [alt]="member.display_name"
                                  class="w-full h-full rounded-full object-cover"
                                />
                              } @else {
                                {{
                                  getInitials(member.display_name || member.email)
                                }}
                              }
                            </div>
                            <div>
                              <p class="text-sm font-medium text-gray-900">
                                {{ member.display_name || 'Unknown' }}
                              </p>
                              <p class="text-sm text-gray-500">
                                {{ member.email }}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <select
                            [ngModel]="member.role"
                            (ngModelChange)="onMemberRoleChange(member, $event)"
                            class="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                        </td>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                        >
                          <button
                            (click)="onRemoveMember(member)"
                            class="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (members().length === 0) {
                <div class="px-6 py-8 text-center text-gray-500">
                  No members found
                </div>
              }
            </div>
          </section>

          <!-- Danger Zone -->
          @if (canDeleteBoard()) {
            <section>
              <div class="bg-white shadow rounded-lg border-2 border-red-200">
                <div class="px-6 py-4 border-b border-red-200 bg-red-50">
                  <h2 class="text-lg font-medium text-red-800">Danger Zone</h2>
                </div>
                <div class="px-6 py-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-medium text-gray-900">
                        Delete Board
                      </h3>
                      <p class="text-sm text-gray-500">
                        Permanently delete this board and all its tasks. This
                        action cannot be undone.
                      </p>
                    </div>
                    <button
                      (click)="onDeleteBoard()"
                      [disabled]="deleting()"
                      class="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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
                        Delete Board
                      }
                    </button>
                  </div>
                </div>
              </div>
            </section>
          }
        } @else {
          <div class="text-center py-12">
            <p class="text-gray-500">Board not found</p>
          </div>
        }
      </div>
    </div>

    <!-- Invite Member Dialog (PrimeNG) -->
    <app-board-invite-member-dialog
      [(visible)]="showInviteDialog"
      [boardId]="boardId"
      [boardName]="board()?.name || ''"
      (invited)="onInviteResult($event)"
    />
  `,
})
export class BoardSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private boardService = inject(BoardService);
  private authService = inject(AuthService);

  workspaceId = '';
  boardId = '';

  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  board = signal<Board | null>(null);
  members = signal<BoardMember[]>([]);
  showInviteDialog = signal(false);

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.boardId = params['boardId'];
      this.loadBoard();
    });
  }

  canDeleteBoard(): boolean {
    // For now, any user can delete. In production, check role
    return !!this.authService.currentUser();
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  onSave(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    const { name, description } = this.form.value;

    this.boardService.updateBoard(this.boardId, { name, description }).subscribe({
      next: (updated) => {
        this.board.set(updated);
        this.form.markAsPristine();
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  onInviteMember(): void {
    this.showInviteDialog.set(true);
  }

  onInviteResult(result: InviteMemberDialogResult): void {
    this.boardService
      .inviteBoardMember(this.boardId, {
        email: result.email,
        role: result.role,
      })
      .subscribe({
        next: (member) => {
          this.members.update((members) => [...members, member]);
        },
        error: () => {
          // Error handling - invite failed
        },
      });
  }

  onMemberRoleChange(member: BoardMember, role: 'viewer' | 'editor'): void {
    this.boardService
      .updateBoardMemberRole(this.boardId, member.user_id, { role })
      .subscribe({
        next: (updatedMember) => {
          this.members.update((members) =>
            members.map((m) =>
              m.user_id === updatedMember.user_id ? updatedMember : m
            )
          );
        },
        error: () => {
          // Revert the UI by reloading members
          this.loadBoardMembers();
        },
      });
  }

  onRemoveMember(member: BoardMember): void {
    if (
      !confirm(
        `Remove ${member.display_name || member.email} from this board?`
      )
    ) {
      return;
    }

    this.boardService.removeBoardMember(this.boardId, member.user_id).subscribe({
      next: () => {
        this.members.update((members) =>
          members.filter((m) => m.user_id !== member.user_id)
        );
      },
      error: () => {
        // Error handling - remove failed
      },
    });
  }

  onDeleteBoard(): void {
    const board = this.board();
    if (!board) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${board.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    this.deleting.set(true);

    this.boardService.deleteBoard(this.boardId).subscribe({
      next: () => {
        this.router.navigate(['/workspace', this.workspaceId]);
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }

  private loadBoard(): void {
    this.loading.set(true);

    this.boardService.getBoard(this.boardId).subscribe({
      next: (board) => {
        this.board.set(board);
        this.form.patchValue({
          name: board.name,
          description: board.description || '',
        });
        this.loadBoardMembers();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadBoardMembers(): void {
    this.boardService.getBoardMembers(this.boardId).subscribe({
      next: (members) => {
        this.members.set(members);
      },
      error: () => {
        // Error handling - failed to load members
      },
    });
  }
}
