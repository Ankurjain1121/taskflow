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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
  imports: [CommonModule, RouterModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }

    .workspace-header-btn {
      transition: all 0.15s ease;
      border-left: 2px solid transparent;
    }
    .workspace-header-btn:hover {
      background: rgba(255, 255, 255, 0.06);
      border-left-color: rgba(99, 102, 241, 0.5);
    }

    .workspace-icon {
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      box-shadow: 0 1px 3px rgba(79, 70, 229, 0.3);
      transition: transform 0.15s ease;
    }
    .workspace-header-btn:hover .workspace-icon {
      transform: scale(1.05);
    }

    .board-link {
      transition: all 0.15s ease;
      border-left: 2px solid transparent;
    }
    .board-link:hover {
      background: rgba(255, 255, 255, 0.04);
      border-left-color: rgba(99, 102, 241, 0.3);
    }

    .board-link-active {
      background: rgba(99, 102, 241, 0.12) !important;
      border-left-color: #6366f1 !important;
      color: #e0e7ff !important;
    }

    .add-board-btn {
      transition: all 0.15s ease;
    }
    .add-board-btn:hover {
      background: rgba(99, 102, 241, 0.15);
    }
  `],
  template: `
    <div class="mb-1">
      <!-- Workspace Header -->
      <button
        (click)="toggleExpanded()"
        class="workspace-header-btn w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-200 rounded-md"
      >
        <!-- Chevron -->
        <svg
          [class]="
            'w-4 h-4 text-gray-500 transition-transform duration-200 ' + (expanded() ? 'rotate-90' : '')
          "
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

        <!-- Workspace Icon -->
        <span
          class="workspace-icon w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
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
              class="w-4 h-4 text-gray-400"
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
        <div class="ml-4 mt-1 space-y-0.5">
          @if (loading()) {
            <div class="px-3 py-2 text-sm text-gray-400">Loading...</div>
          } @else if (boards().length === 0) {
            <div class="px-3 py-2 text-sm text-gray-600 italic">No boards</div>
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
                class="board-link flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 rounded-md"
              >
                <svg
                  class="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
                <span class="truncate">{{ board.name }}</span>
              </a>
            }
          }
        </div>
      }
    </div>
  `,
})
export class WorkspaceItemComponent implements OnInit {
  private boardService = inject(BoardService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);

  workspace = input.required<Workspace>();

  expanded = signal(false);
  loading = signal(false);
  boards = signal<Board[]>([]);

  ngOnInit(): void {
    // Auto-expand first workspace
    this.expanded.set(true);
    this.loadBoards();
  }

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
    if (this.expanded() && this.boards().length === 0) {
      this.loadBoards();
    }
  }

  canCreateBoard(): boolean {
    const user = this.authService.currentUser();
    // Simplified check - in real app, check workspace membership role
    return !!user;
  }

  onAddBoardClick(event: Event): void {
    event.stopPropagation();
    const dialogRef = this.dialog.open(CreateBoardDialogComponent, {
      data: {
        workspaceId: this.workspace().id,
        workspaceName: this.workspace().name,
      },
    });

    dialogRef.afterClosed().subscribe((result: CreateBoardDialogResult | undefined) => {
      if (result) {
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
            error: (err) => {
              console.error('Failed to create board:', err);
            },
          });
      }
    });
  }

  private loadBoards(): void {
    this.loading.set(true);
    this.boardService.listBoards(this.workspace().id).subscribe({
      next: (boards) => {
        this.boards.set(boards);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load boards:', err);
        this.loading.set(false);
      },
    });
  }
}
