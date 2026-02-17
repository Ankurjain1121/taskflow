import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BoardService, Board } from '../../../core/services/board.service';
import { Workspace } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  CreateBoardDialogComponent,
  CreateBoardDialogResult,
} from '../dialogs/create-board-dialog.component';

@Component({
  selector: 'app-workspace-item',
  standalone: true,
  imports: [CommonModule, RouterModule, CreateBoardDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }

    .workspace-header-btn {
      transition: background var(--duration-fast) var(--ease-standard);
    }
    .workspace-header-btn:hover {
      background: var(--sidebar-surface-hover);
    }

    .workspace-icon {
      transition: transform var(--duration-fast) var(--ease-standard);
    }
    .workspace-header-btn:hover .workspace-icon {
      transform: scale(1.05);
    }

    .board-link {
      transition: background var(--duration-fast) var(--ease-standard),
                  color var(--duration-fast) var(--ease-standard);
      color: var(--sidebar-text-secondary);
    }
    .board-link:hover {
      background: var(--sidebar-surface-hover);
      color: var(--sidebar-text-primary);
    }

    .board-link-active {
      background: var(--sidebar-surface-active) !important;
      color: var(--sidebar-text-primary) !important;
    }

    /* Tree-view vertical guide line */
    .board-tree {
      position: relative;
    }
    .board-tree::before {
      content: '';
      position: absolute;
      left: 1.125rem;
      top: 0;
      bottom: 0.5rem;
      width: 1px;
      background: var(--sidebar-border);
    }

    .add-board-btn {
      transition: opacity var(--duration-fast) var(--ease-standard),
                  background var(--duration-fast) var(--ease-standard);
    }
    .add-board-btn:hover {
      background: var(--sidebar-surface-hover);
    }
  `],
  template: `
    <div class="mb-0.5">
      <!-- Workspace Header -->
      <button
        (click)="toggleExpanded()"
        class="workspace-header-btn w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md"
        style="color: var(--sidebar-text-secondary)"
      >
        <!-- Chevron -->
        <svg
          [class]="
            'w-3.5 h-3.5 transition-transform duration-200 ' + (expanded() ? 'rotate-90' : '')
          "
          style="color: var(--sidebar-text-muted)"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>

        <!-- Workspace Icon (flat accent color, no shadow) -->
        <span
          class="workspace-icon w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white"
          [style.background]="getColor()"
        >
          {{ workspace().name.charAt(0).toUpperCase() }}
        </span>

        <!-- Workspace Name -->
        <span class="flex-1 text-left truncate">{{ workspace().name }}</span>

        <!-- Add Board Button (manager/admin only) -->
        @if (canCreateBoard()) {
          <button
            (click)="onAddBoardClick($event)"
            class="add-board-btn p-1 rounded opacity-0 group-hover:opacity-100"
            title="Add Board"
          >
            <svg
              class="w-3.5 h-3.5"
              style="color: var(--sidebar-text-muted)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        }
      </button>

      <!-- Boards List -->
      @if (expanded()) {
        <div class="board-tree ml-4 mt-0.5 space-y-0.5">
          @if (loading()) {
            <div class="px-3 py-1.5 text-sm" style="color: var(--sidebar-text-muted)">Loading...</div>
          } @else if (boards().length === 0) {
            <div class="px-3 py-1.5 text-xs italic" style="color: var(--sidebar-text-muted)">No boards</div>
          } @else {
            @for (board of boards(); track board.id) {
              <a
                [routerLink]="[
                  '/workspace',
                  workspace().id,
                  'board',
                  board.id
                ]"
                routerLinkActive="board-link-active"
                class="board-link flex items-center gap-2 px-3 py-1.5 text-sm rounded-md"
              >
                <i class="pi pi-table text-xs" style="color: var(--sidebar-text-muted)"></i>
                <span class="truncate">{{ board.name }}</span>
              </a>
            }
          }
        </div>
      }
    </div>

    <!-- Create Board Dialog (PrimeNG) -->
    <app-create-board-dialog
      [(visible)]="showCreateBoardDialog"
      [workspaceId]="workspace().id"
      [workspaceName]="workspace().name"
      (created)="onBoardCreated($event)"
    />
  `,
})
export class WorkspaceItemComponent implements OnInit {
  private boardService = inject(BoardService);
  private authService = inject(AuthService);

  workspace = input.required<Workspace>();

  expanded = signal(false);
  loading = signal(false);
  boards = signal<Board[]>([]);
  showCreateBoardDialog = signal(false);

  private readonly colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#06b6d4',
  ];

  ngOnInit(): void {
    this.expanded.set(true);
    this.loadBoards();
  }

  getColor(): string {
    const charCode = this.workspace().name.charCodeAt(0) || 0;
    return this.colors[charCode % this.colors.length];
  }

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
    if (this.expanded() && this.boards().length === 0) {
      this.loadBoards();
    }
  }

  canCreateBoard(): boolean {
    const user = this.authService.currentUser();
    return !!user;
  }

  onAddBoardClick(event: Event): void {
    event.stopPropagation();
    this.showCreateBoardDialog.set(true);
  }

  onBoardCreated(result: CreateBoardDialogResult): void {
    this.boardService
      .createBoard(this.workspace().id, {
        name: result.name,
        description: result.description,
        template: result.template,
      })
      .subscribe({
        next: (board) => {
          this.boards.update((boards) => [...boards, board]);
          if (!this.expanded()) {
            this.expanded.set(true);
          }
        },
        error: () => {
          // Error handling - board creation failed
        },
      });
  }

  private loadBoards(): void {
    this.loading.set(true);
    this.boardService.listBoards(this.workspace().id).subscribe({
      next: (boards) => {
        this.boards.set(boards);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
