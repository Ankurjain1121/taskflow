import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  WorkspaceService,
  Workspace,
  WorkspaceMember,
} from '../../core/services/workspace.service';
import { BoardService, Board } from '../../core/services/board.service';
import {
  CreateBoardDialogComponent,
  CreateBoardDialogResult,
} from '../../shared/components/dialogs/create-board-dialog.component';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 p-6 md:p-8">
      <div class="max-w-7xl mx-auto">
        <!-- Loading State -->
        @if (loading()) {
          <div class="flex items-center justify-center py-24">
            <mat-spinner diameter="48"></mat-spinner>
          </div>
        } @else if (error()) {
          <!-- Error State -->
          <div class="text-center py-24">
            <div class="text-red-500 text-lg mb-2">Failed to load workspace</div>
            <p class="text-gray-500 mb-4">{{ error() }}</p>
            <button mat-flat-button color="primary" (click)="loadData()">
              Retry
            </button>
          </div>
        } @else {
          <!-- Header -->
          <div class="flex items-center justify-between mb-8">
            <div>
              <h1 class="text-3xl font-bold text-gray-900">
                {{ workspace()?.name }}
              </h1>
              <p class="text-gray-500 mt-1">Workspace overview</p>
            </div>
            <div class="flex items-center gap-3">
              <a
                mat-stroked-button
                [routerLink]="['/workspace', workspaceId(), 'team']"
              >
                <mat-icon class="mr-1">group</mat-icon>
                Team Overview
              </a>
              <a
                mat-stroked-button
                [routerLink]="['/workspace', workspaceId(), 'settings']"
              >
                <mat-icon class="mr-1">settings</mat-icon>
                Settings
              </a>
            </div>
          </div>

          <!-- Stats Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div class="bg-white rounded-xl border border-gray-200 p-5">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"
                >
                  <mat-icon class="text-blue-600">dashboard</mat-icon>
                </div>
                <div>
                  <p class="text-2xl font-bold text-gray-900">
                    {{ boards().length }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ boards().length === 1 ? 'Board' : 'Boards' }}
                  </p>
                </div>
              </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"
                >
                  <mat-icon class="text-green-600">people</mat-icon>
                </div>
                <div>
                  <p class="text-2xl font-bold text-gray-900">
                    {{ members().length }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ members().length === 1 ? 'Member' : 'Members' }}
                  </p>
                </div>
              </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"
                >
                  <mat-icon class="text-purple-600">view_kanban</mat-icon>
                </div>
                <div>
                  <p class="text-2xl font-bold text-gray-900">
                    {{ totalTaskEstimate() }}
                  </p>
                  <p class="text-sm text-gray-500">Est. Tasks</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Board Grid Header -->
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-xl font-semibold text-gray-900">Boards</h2>
            <button mat-flat-button color="primary" (click)="openCreateBoardDialog()">
              <mat-icon class="mr-1">add</mat-icon>
              Create Board
            </button>
          </div>

          <!-- Empty State -->
          @if (boards().length === 0) {
            <div
              class="animate-fade-in-up bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center"
            >
              <div class="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 via-blue-50 to-violet-100 dark:from-indigo-900/30 dark:via-blue-900/20 dark:to-violet-900/30 flex items-center justify-center mb-5">
                <svg class="w-10 h-10 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Create your first board</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                Boards are where the magic happens. Organize tasks into columns and track progress visually.
              </p>
              <button mat-flat-button color="primary" (click)="openCreateBoardDialog()">
                <mat-icon class="mr-1">add</mat-icon>
                Create Board
              </button>
            </div>
          } @else {
            <!-- Board Cards Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (board of boards(); track board.id; let i = $index) {
                <a
                  [routerLink]="['/workspace', workspaceId(), 'board', board.id]"
                  class="animate-fade-in-up bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group block"
                  [style.animation-delay]="(i * 0.06) + 's'"
                >
                  <div class="flex items-start justify-between mb-3">
                    <div
                      class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors"
                    >
                      <mat-icon class="text-blue-600">view_kanban</mat-icon>
                    </div>
                    <mat-icon
                      class="text-gray-400 group-hover:text-blue-500 transition-colors"
                    >
                      arrow_forward
                    </mat-icon>
                  </div>
                  <h3
                    class="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors"
                  >
                    {{ board.name }}
                  </h3>
                  @if (board.description) {
                    <p class="text-sm text-gray-500 line-clamp-2 mb-3">
                      {{ board.description }}
                    </p>
                  } @else {
                    <p class="text-sm text-gray-400 italic mb-3">No description</p>
                  }
                  <div class="flex items-center text-xs text-gray-400">
                    <mat-icon
                      class="mr-1"
                      style="font-size: 14px; width: 14px; height: 14px;"
                    >
                      calendar_today
                    </mat-icon>
                    Created {{ formatDate(board.created_at) }}
                  </div>
                </a>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
})
export class WorkspaceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);
  private dialog = inject(MatDialog);

  workspaceId = signal<string>('');
  workspace = signal<Workspace | null>(null);
  boards = signal<Board[]>([]);
  members = signal<WorkspaceMember[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  totalTaskEstimate = computed(() => {
    // Each board is estimated at ~10 tasks as a rough indicator
    return this.boards().length * 10;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('workspaceId');
      if (id) {
        this.workspaceId.set(id);
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    const id = this.workspaceId();

    // Load workspace details
    this.workspaceService.get(id).subscribe({
      next: (ws) => this.workspace.set(ws),
      error: (err) => {
        this.error.set('Could not load workspace details.');
        this.loading.set(false);
      },
    });

    // Load boards
    this.boardService.listBoards(id).subscribe({
      next: (boards) => this.boards.set(boards),
      error: () => {},
    });

    // Load members
    this.workspaceService.getMembers(id).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openCreateBoardDialog(): void {
    const dialogRef = this.dialog.open(CreateBoardDialogComponent, {
      data: {
        workspaceId: this.workspaceId(),
        workspaceName: this.workspace()?.name || 'Workspace',
      },
    });

    dialogRef.afterClosed().subscribe((result: CreateBoardDialogResult | undefined) => {
      if (result) {
        this.boardService
          .createBoard(this.workspaceId(), {
            name: result.name,
            description: result.description,
            template: result.template,
          })
          .subscribe({
            next: () => {
              this.loadData();
            },
            error: (err) => {
              console.error('Failed to create board:', err);
            },
          });
      }
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
