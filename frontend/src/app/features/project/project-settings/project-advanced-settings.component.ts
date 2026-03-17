import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ProjectService,
  Board,
} from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';

@Component({
  selector: 'app-project-advanced-settings',
  standalone: true,
  imports: [CommonModule, ConfirmDialog],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <!-- Archive Project -->
      <section>
        <div class="bg-[var(--card)] shadow rounded-lg">
          <div class="px-6 py-4 border-b border-[var(--border)]">
            <h2 class="text-lg font-medium text-[var(--foreground)]">
              Archive
            </h2>
          </div>
          <div class="px-6 py-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-medium text-[var(--foreground)]">
                  Archive Board
                </h3>
                <p class="text-sm text-[var(--muted-foreground)]">
                  Hide this board from the sidebar. It can be
                  restored later from the Archived section.
                </p>
              </div>
              <button
                (click)="onArchiveBoard()"
                [disabled]="archiving()"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                @if (archiving()) {
                  <svg
                    class="animate-spin h-4 w-4"
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
                  Archiving...
                } @else {
                  <i class="pi pi-inbox"></i>
                  Archive Board
                }
              </button>
            </div>
          </div>
        </div>
      </section>

      @if (canDeleteBoard()) {
        <section>
          <div
            class="shadow rounded-lg border-2"
            style="background: var(--card); border-color: var(--status-red-border)"
          >
            <div
              class="px-6 py-4"
              style="border-bottom: 1px solid var(--status-red-border); background: var(--status-red-bg)"
            >
              <h2
                class="text-lg font-medium"
                style="color: var(--status-red-text)"
              >
                Danger Zone
              </h2>
            </div>
            <div class="px-6 py-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3
                    class="text-sm font-medium text-[var(--foreground)]"
                  >
                    Delete Board
                  </h3>
                  <p class="text-sm text-[var(--muted-foreground)]">
                    Permanently delete this board and all its tasks.
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  (click)="onDeleteBoard()"
                  [disabled]="deleting()"
                  class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  style="border: 1px solid var(--status-red-border); color: var(--status-red-text); background: var(--card)"
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
    </div>

    <p-confirmDialog />
  `,
})
export class ProjectAdvancedSettingsComponent {
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  board = input<Board | null>(null);
  boardId = input.required<string>();
  workspaceId = input.required<string>();

  errorOccurred = output<string>();

  archiving = signal(false);
  deleting = signal(false);

  canDeleteBoard(): boolean {
    return !!this.authService.currentUser();
  }

  onArchiveBoard(): void {
    const board = this.board();
    if (!board) return;

    this.confirmationService.confirm({
      message: `Archive "${board.name}"? It will be hidden from the sidebar but can be restored later.`,
      header: 'Archive Board',
      icon: 'pi pi-inbox',
      acceptButtonStyleClass: 'p-button-warning p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.archiving.set(true);
        this.projectService.deleteBoard(this.boardId()).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Board Archived',
              detail: `"${board.name}" has been archived.`,
              life: 4000,
            });
            this.router.navigate(['/workspace', this.workspaceId()]);
          },
          error: () => {
            this.archiving.set(false);
            this.errorOccurred.emit('Failed to archive board');
          },
        });
      },
    });
  }

  onDeleteBoard(): void {
    const board = this.board();
    if (!board) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${board.name}"? This action cannot be undone. All tasks, columns, and data will be permanently lost.`,
      header: 'Delete Board',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.deleting.set(true);

        this.projectService.deleteBoard(this.boardId()).subscribe({
          next: () => {
            this.router.navigate(['/workspace', this.workspaceId()]);
          },
          error: () => {
            this.deleting.set(false);
          },
        });
      },
    });
  }
}
